import fetch from "node-fetch";
import moment from "moment";
import FileData from "./core/filedata";
import { IUserLogs } from "./interfaces/logs";
import express from "express";
import * as bodyParser from "body-parser";
import * as schedule from "node-schedule";
import { IDingTalkTokenResponseResult, ILogs, ITimeSheetData } from "./interfaces";
import DingTalkService from "./services/dingTalk.service";
import config from "./config";
import AttendanceService from "./services/attendance.service";
import ReportService from "./services/report.service";
import SMSApi from "./apis/smsApi";
import RedisHelper from "./core/redisHelper";
import * as http from "http";
import SocketService from "./services/socket.service";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
let dingTalkService: DingTalkService;

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
});

async function init() {
  try {
    await RedisHelper.connection();
    const res: IDingTalkTokenResponseResult = await fetch(`${config.dingTalk.apiUrl}/gettoken?appkey=${config.dingTalk.apikey}&appsecret=${config.dingTalk.apisecret}`).then((res) => res.json());
    global["DingTalkAccessToken"] = res.access_token;
    dingTalkService = new DingTalkService();
    console.log("DingTalk configuration successful!");
  } catch (err) {
    console.log(err);
  }
}

app.get("/", async (req, res) => {
  res.send("Health!");
});

app.get("/api/logs/get", async (req, res) => {
  const month = moment().format("YYYY-MM");
  let dingdingLogs = await FileData.readLogs(month);
  let customLogs = await FileData.readCustomLogs(month);
  let mergeLogs = dingdingLogs.map((ul: IUserLogs, index: number) => {
    customLogs[index].logs.forEach((x: ILogs[], i) => {
      if (x !== null) {
        ul.logs[i] = x;
      }
    })
    return ul;
  })
  res.send(mergeLogs);
});

app.put("/api/logs/update", async (req, res) => {
  const { date, day, name } = req.body;
  let _date = date ? moment(date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
  const attendanceServive = new AttendanceService();
  try {
    const result = await attendanceServive.generateUserAttendances(_date, day, name);
    res.send(result);
  }
  catch (error) {
    console.log(error);
  }
});

app.put("/api/logs/custom", async (req, res) => {
  let date = moment().format("YYYY-MM");
  const { userId, index, datas } = req.body;
  let logs = await FileData.readCustomLogs(date);
  logs = logs.map((x: IUserLogs) => {
    if (x.id === userId) {
      x.logs[index] = datas;
    }
    return x;
  });
  const result = await FileData.writeCustomLogs(date, logs);
  res.send(result);
});

app.post("/api/user/add", async (req, res) => {
  const { name, dept_name, groupid } = req.body;
  let userDetail = await dingTalkService.getUsersName(name);
  console.log(userDetail)
  if (!userDetail) {
    res.send("没有找到该用户的信息.");
    return;
  }

  userDetail = { ...userDetail, groupid: groupid || null };

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
  let userlogs = await FileData.readLogs(fileName);
  userlogs.splice(lastIndex + 1, 0, {
    id: userDetail.id,
    name: userDetail.name,
    dept_name: userDetail.dept_name,
    logs: Array.from(new Array(moment().daysInMonth()), () => [])
  });
  await FileData.writeLogs(fileName, userlogs);
  customLogs.splice(lastIndex + 1, 0, {
    id: userDetail.id,
    name: userDetail.name,
    dept_name: userDetail.dept_name,
    logs: Array.from(new Array(moment().daysInMonth()), () => null)
  });
  const result = await FileData.writeCustomLogs(fileName, customLogs);
  res.send(result);
});

app.delete("/api/user/delete", async (req, res) => {
  const { userId } = req.query;

  let users = await FileData.readUsers();
  let index = users.findIndex(x => x.id === userId);

  if (index === -1) {
    res.send("没有找到该用户的信息.");
    return;
  }

  users.splice(index, 1);
  await FileData.writeUsers(JSON.stringify(users));
  const fileName = moment().format("YYYY-MM");
  let customLogs = await FileData.readCustomLogs(fileName);
  let userlogs = await FileData.readLogs(fileName);
  userlogs.splice(index, 1);
  await FileData.writeLogs(fileName, userlogs);
  customLogs.splice(index, 1);
  const result = await FileData.writeCustomLogs(fileName, customLogs);
  res.send(result);
});

app.get("/api/user/get", async (req, res) => {
  const { userId } = req.query;
  const users = await FileData.readUsers();
  if (userId) {
    const user = users.find(x => x.id === userId);
    res.send(user);
    return;
  }
  res.send(users);
});

app.put("/api/user/update", async (req, res) => {
  const { name, id, phone, dept_name, english_name, groupid } = req.body;
  let users = await FileData.readUsers();
  if (id) {
    users = users.map(user => {
      if (user.id === id) {
        user.name = name || user.name;
        user.phone = phone || null;
        user.dept_name = dept_name || null;
        user.english_name = english_name || null;
        user.groupid = groupid || null;
      }
      return user;
    });
  }

  const result = await FileData.writeUsers(JSON.stringify(users));

  res.send(result);
});

app.get("/api/user/dingding", async (req, res) => {
  const users = await dingTalkService.getUsers();
  res.send(users);
});

app.get("/api/user/clean-office", async (req, res) => {
  const { current, next, users } = await FileData.readCleanUsers();
  res.send({
    current: users[current],
    next: users[next]
  })
});

app.get("/api/user/dept", async (req, res) => {
  const result = await FileData.readDepartments();
  res.send(result);
});

app.put("/api/timesheet/update", async (req, res) => {
  const { template } = req.body;
  const result = await FileData.writeTimeSheetTemplate(JSON.stringify(template));
  res.send(result);
})

app.get("/api/timesheet/get", async (req, res) => {
  const { dept_name } = req.query;
  const templateData = await FileData.readTimeSheetTemplate();
  const users = await FileData.readUsers();
  let datas = await RedisHelper.getByAsync<ITimeSheetData[]>("timesheets");
  let timeSheetData = users.filter(x => x.dept_name === dept_name).map(x => {
    return {
      name: x.english_name,
      groupid: x.groupid,
      value: datas.find(d => d.name === x.english_name)?.value || null
    }
  })
  res.send({
    template: templateData,
    data: timeSheetData
  });
})

async function schedules() {
  console.log("Schedules job successful!");
  const { attendanceRule, reportRule, refreshDingTalkConfigRule, saveTimeSheetRule } = config.job;
  schedule.scheduleJob(refreshDingTalkConfigRule, async () => {
    console.log("Refresh Dingtalk configuration.");
    await init();
  });

  schedule.scheduleJob(attendanceRule, async () => {
    let _date = moment().add(-1, "days").format("YYYY-MM-DD");
    console.log(`${_date} logs updating...`);
    const attendanceServive = new AttendanceService();
    try {
      const result = await attendanceServive.generateUserAttendances(_date);
      console.log(result ? `${_date} logs update successful!` : "Logs update failed!");
    }
    catch (err) {
      console.log(err);
      console.log("Logs update failed!");
    }
  });

  schedule.scheduleJob(reportRule, async () => {
    let reportService = new ReportService();
    const startTime = moment().format("YYYY-MM-DD 09:00:00");
    const endTime = moment().format("YYYY-MM-DD 21:00:00");
    let users = await reportService.getNotCommitReportUsers(startTime, endTime);
    if (users.length === 0) {
      console.log("Everyone submitted a report!");
    }
    for (let user of users) {
      console.log("Not commit report : ", user.name);
      await SMSApi.sendNotCommitReportSMS({ name: user.name, phone: user.phone }, moment().format("YYYY-MM-DD"));
    }
  });

  schedule.scheduleJob(saveTimeSheetRule, async () => {
    const currentDate = moment();
    const holidays = await FileData.readHolidays(currentDate.year().toString());
    let isHoliday = holidays.includes(currentDate.format("YYYY-MM-DD"));
    if (isHoliday) {
      return;
    }
    console.log("Saving TimeSheet...");
    let timeSheetList = await RedisHelper.getByAsync<ITimeSheetData[]>("timesheets");
    const result = await FileData.writeTimeSheet(currentDate.format("YYYY-MM-DD"), JSON.stringify(timeSheetList));
    if (result) {
      console.log("Save TimeSheet successful!");
      await RedisHelper.setAsync("timesheets", "[]");
    } else {
      console.log("Save TimeSheet Failed!");
    }
  });
}

async function start() {
  const server = http.createServer(app);
  await new SocketService(server);
  server.listen(config.server.port, async () => {
    await init();
    await schedules();
    console.log(`App listening on port ${config.server.port}.`);
  })
}

start();