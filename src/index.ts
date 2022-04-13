import fetch from "node-fetch";
import moment from "moment";
import * as config from "./configs/config";
import DingdingApi from "./apis/dingdingApi";
import FileData from "./core/filedata";
import * as utils from "./utils/utils";
import { IUser, IUserLogs } from "./interfaces/logs";
import LogService from "./services/logs.service";
import express from "express";
import * as bodyParser from "body-parser";
import * as schedule from "node-schedule";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

const port = 3334;
let dingdingApi: DingdingApi;
const bossID = "manager9941";

app.use((req, res, next) => {
  res.set({
    "Access-Control-Allow-Credentials": true,
    "Access-Control-Max-Age": 1728000,
    "Access-Control-Allow-Origin": req.headers.origin || "*",
    "Access-Control-Allow-Headers": "X-Requested-With,Content-Type",
    "Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  })
  req.method === "OPTIONS" ? res.status(204).end() : next()
})

async function initDingDingApi() {
  const token: ITokenResponseProps = await fetch(
    `https://oapi.dingtalk.com/gettoken?appkey=${config.apikey}&appsecret=${config.apisecret}`
  ).then((res) => res.json());
  dingdingApi = new DingdingApi(token.access_token);
}

app.get("/", async (req, res) => {
  res.send("Health!");
});

app.get("/api/logs/get", async (req, res) => {
  await initDingDingApi();
  const month = moment().format("YYYY-MM");
  let dingdingLogs = await FileData.readLogs(month);
  let customLogs = await FileData.readCustomLogs(month);
  let mergeLogs = dingdingLogs.map((ul: IUserLogs, index: number) => {
    customLogs[index].logs.forEach((x, i) => {
      if (x !== null) {
        ul.logs[i] = x;
      }
    })
    return ul;
  })
  res.send(mergeLogs);
});

app.put("/api/logs/update", async (req, res) => {
  await initDingDingApi();
  const { date, day } = req.body;
  let _date = date ? moment(date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
  let dates = generateLogsDates(_date, day || 8);
  try {
    const result = await generateUserLogs(dates);
    res.send(result ? `${_date} 数据更新成功.` : "数据更新失败.");
  }
  catch (err) {
    console.log(err);
  }
});

app.put("/api/logs/custom", async (req, res) => {
  let date = moment().format("YYYY-MM");
  const { userId, index, datas } = req.body;
  let logs = await FileData.readCustomLogs(date);
  logs = logs.map((x: IUserLogs) => {
    if (x.id === userId) {
      x.logs[index] = datas
    }
    return x;
  });
  const result = await FileData.writeCustomLogs(logs, date);
  res.send(result);
});

app.post("/api/user/add", async (req, res) => {
  await initDingDingApi();
  const { name, dept_name } = req.body;
  let userDetail = await getUserByName(name);
  if (!userDetail) {
    res.send("没有找到该用户的信息.");
    return;
  }
  userDetail.dept_name = dept_name;
  let users = await FileData.readUsers();
  if (users.find(x => x.id === userDetail.id)) {
    res.send("已存在该用户.");
    return;
  }
  let lastIndex = users.length;
  users.forEach((x, index) => {
    if (x.dept_name === dept_name) lastIndex = index;
  });

  users.splice(lastIndex + 1, 0, userDetail);
  await FileData.writeUsers(JSON.stringify(users));
  const fileName = moment().format("YYYY-MM");
  let customLogs = await FileData.readCustomLogs(fileName);
  customLogs.push({
    id: userDetail.id,
    name: userDetail.name,
    dept_name: userDetail.dept_name,
    logs: Array.from(new Array(moment().daysInMonth()), () => null)
  });
  await FileData.writeCustomLogs(customLogs, fileName);
  res.send(users);
});

app.get("/api/user/get", async (req, res) => {
  const users = await FileData.readUsers();
  res.send(users);
});

app.get("/api/user/dingding", async (req, res) => {
  await initDingDingApi();
  const users = await getUsers();
  res.send(users);
});

app.get("/api/user/clean-office", async (req, res) => {
  const { current, next, users } = await FileData.readCleanUsers();
  res.send({
    current: users[current],
    next: users[next]
  })
});

async function schedules() {
  // 晚上20点执行发送短信任务
  schedule.scheduleJob('0 0 20 * * *', async () => {
    await sendNotCommitLogsSMS();
  });
  
  // 工作日早上09:00:01执行日志生成任务
  schedule.scheduleJob('1 0 9 * * *', async () => {
    let current = moment();
    const date = moment().format("YYYY-MM-DD");

    const holidays = await FileData.readHolidays(current.year().toString());
    if (!holidays.includes(date)) {
      console.log(`${date}日志生成中...`);
      await initDingDingApi();
      let dates = generateLogsDates(date);
      await generateUserLogs(dates);
      console.log(`${date}日志生成完成!`);
    }
  });
}

interface ITokenResponseProps {
  access_token: string;
}

async function sendNotCommitLogsSMS() {
  const startTime = moment()
    .startOf("day")
    .add("9", "hours")
    .format("YYYY-MM-DD HH:mm:ss");
  const endTime = moment()
    .endOf("day")
    .subtract("3", "hours")
    .format("YYYY-MM-DD HH:mm:ss");

  const users = await getUsers();
  const userIds = users.map(x => parseInt(x.id));

  // 当天应交日报的员工ID
  const attendance = await dingdingApi.getPunchIn(userIds, startTime, endTime);
  const offDutyAttendance = attendance
    .filter((punch: any) => punch.checkType === "OffDuty")
    .map((item: any) => item.userId);

  const cursor = 0;
  let reports: any = [];

  const getAllReports = (cursor: number) => {
    return dingdingApi
      .getReport(startTime, endTime, cursor)
      .then(async (report) => {
        reports = [...reports, ...report.data_list];
        if (report.has_more) {
          await getAllReports(report.next_cursor);
        }
        return [...reports, ...report.data_list];
      })
      .catch((error) => {
        console.log(error);
      });
  };
  await getAllReports(cursor);

  // 所有已交日报员工的ID(去除重复提交的日报)
  let allReportedUserIDs = reports.map((report: any) => report.creator_id);
  allReportedUserIDs = allReportedUserIDs.filter(
    (id: string, index: number) => allReportedUserIDs.indexOf(id) === index
  );
  console.log("下班打卡：" + offDutyAttendance.length + "人");
  console.log("日志已提交：" + allReportedUserIDs.length + "人");

  // 未交日报员工
  let noReportUserIDs = offDutyAttendance.filter(
    (item: string) => !allReportedUserIDs.includes(item)
  );
  console.log(endTime + "未交日报员工：" + noReportUserIDs.length + "人");
  const promiseUserArray: any[] = [];
  noReportUserIDs.forEach((userID: string) => {
    const promise = dingdingApi.getUserName(userID);
    promiseUserArray.push(promise);
  });
  const allUserName = await Promise.all(promiseUserArray);
  console.log(
    allUserName.length === 0
      ? offDutyAttendance.length === 0
        ? "今天无需提交日报"
        : "日报已交齐"
      : `${endTime}未交日报员工: ${allUserName}`
  );

  // 如果有未交日报员工的电话，并且不是周末
  if (allUserName.length > 0) {
    let phoneList = allUserName.map((user: string) => {
      return {
        name: user,
        phone: users.find((i) => i.name === user)?.phone,
      };
    });
    console.log(phoneList);
    phoneList.forEach((user) => {
      dingdingApi.sendSms(user, endTime);
    });
  }
}


// 获取所有部门Id

async function getAllDeptIds() {
  const departments: any[] = await dingdingApi.getDepartments();
  let departmentIds = [];
  for (const d of departments) {
    let _departmentIds = await dingdingApi.getChildrenDepartments(d.dept_id);
    departmentIds.push(..._departmentIds);
  }
  return utils.unique<number>(departmentIds);
}

// 获取所有用户Id
async function getUserDeptIds(departmentIds) {
  const userIds = [];
  for (let id of departmentIds) {
    const user = await dingdingApi.getUserIDs(id);
    userIds.push(...user);
  }
  return utils.unique<string>(userIds);
}

// 获取用户详情
async function getUsersDetail(userIds) {
  const users: IUser[] = [];
  for (let id of userIds) {
    const user = await dingdingApi.getUserDetail(id);
    users.push({
      id: user["userid"],
      name: user["name"],
      unionid: user["unionid"],
      dept_id_list: user["dept_id_list"],
      dept_name: "",
      phone: ""
    });
  }
  return users;
}

// 获取所有用户
async function getUsers() {
  // 获取所有的部门
  const departmentIds = await getAllDeptIds();
  // 获取部门详情
  // const deptDetails = [];
  // for (let deptId of departmentIds) {
  //   const data = await dingdingApi.getDeptDetail(deptId);
  //   deptDetails.push(data);
  // }
  let userIds = await getUserDeptIds(departmentIds);
  userIds = userIds.filter(x => {
    if (x != bossID) return x;
  })
  const users = await getUsersDetail(userIds);
  return users;
}

// 根据用户名称获取用户ID
async function getUserByName(name: string) {
  const users = await getUsers();
  return users.find(x => x.name === name);
}

async function initUserData() {
  const users = await getUsers();
  // await DbData.writeUsers(JSON.stringify(users));
}

/**
 * 
 * @param date 开始日期
 * @param day 生成往日多少天 默认8天
 * @returns string[]
 * date 2020-04-04
 * day 2
 * return [2020-04-03,2020-04-02]
 */
function generateLogsDates(date, day = 8): string[] {
  let dates = [];
  // 判断后一天是否是当前月
  let _date = moment(date).format("YYYYMM") === moment(date).add(-1, "days").format("YYYYMM");

  while (dates.length !== day && _date) {
    let dateCount = dates.length == 0 ? 1 : dates.length + 1;
    dates.push(moment(date).add(-dateCount, "days").format("YYYY-MM-DD"));
    _date = moment(date).add(-dateCount, "days").format("YYYYMM") === moment(date).add(-(dateCount + 1), "days").format("YYYYMM");
  }
  return dates.reverse();
}

function initUserLogs(users: IUser[], userLogs: IUserLogs[], days: number) {
  if (userLogs.length !== users.length) {
    // to do 可优化
    userLogs = users.map(user => {
      let _userlog = userLogs.find(x => x.name);
      return {
        id: user.id,
        name: user.name,
        dept_name: user.dept_name,
        logs: _userlog ? _userlog.logs : Array.from(new Array(days), () => [])
      }
    });
    return userLogs;
  }
  return userLogs;
}

async function generateUserLogs(dates: string[]) {
  const firstDate = dates[0];
  const year = moment(firstDate).format("YYYY"),
    month = moment(firstDate).format("YYYY-MM"),
    days = moment(firstDate).daysInMonth();

  const users = await FileData.readUsers();
  const holidays = await FileData.readHolidays(year);
  let userLogs = await FileData.readLogs(month);
  // 新增用户初始化logs
  userLogs = initUserLogs(users, userLogs, days);
  for (let d of dates) {
    let isHoliday = holidays.includes(d);
    for (let user of users) {
      let currentIndex = userLogs.findIndex(ul => ul.name === user.name);
      let index = parseInt(moment(d).format("D")) - 1;

      // 节假日
      if (isHoliday) {
        userLogs[currentIndex].logs[index] = [];
      } else {
        const logService = new LogService(dingdingApi,
          {
            start: `${d} 00:00:00`,
            end: `${d} 23:59:59`,
            work: `${d} 09:00:00`
          },
          holidays);
        await logService.build(user);
        userLogs[currentIndex].logs[index] = logService.logs;
      }
    }
  }
  return await FileData.writeLogs(userLogs, month);
}

app.listen(port, async () => {
  await schedules();
  console.log(`App listening on port ${port}`)
})