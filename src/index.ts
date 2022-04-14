import fetch from "node-fetch";
import moment from "moment";
import FileData from "./core/filedata";
import { IUserLogs } from "./interfaces/logs";
import express from "express";
import * as bodyParser from "body-parser";
import * as schedule from "node-schedule";
import { IDingTalkTokenResponseResult } from "./interfaces";
import DingTalkService from "./services/dingTalk.service";
import config from "./config";
import AttendanceService from "./services/attendance.service";
import ReportService from "./services/report.service";
import SMSApi from "./apis/smsApi";

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
    const res: IDingTalkTokenResponseResult = await fetch(`${config.dingTalk.apiUrl}/gettoken?appkey=${config.dingTalk.apikey}&appsecret=${config.dingTalk.apisecret}`).then((res) => res.json());
    global["DingTalkAccessToken"] = res.access_token;
    dingTalkService = new DingTalkService();
    console.log("DingTalk configuration successed!");
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
  const { date, day } = req.body;
  let _date = date ? moment(date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
  const attendanceServive = new AttendanceService();
  try {
    const result = await attendanceServive.generateUserAttendances(_date, day);
    res.send(result ? `${_date} update successed!` : "Update failed!");
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
  const { name, dept_name } = req.body;
  let userDetail = await dingTalkService.getUsersName(name);
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

async function schedules() {
  console.log("Schedules job successed!");

  // 刷新钉钉配置
  schedule.scheduleJob("59 59 * * * *", async () => {
    console.log("Refresh Dingtalk configuration.");
    await init();
  });

  schedule.scheduleJob("1 0 12 * * *", async () => {
    let _date = moment().format("YYYY-MM-DD");
    console.log(`${_date} logs updating...`);
    const attendanceServive = new AttendanceService();
    try {
      const result = await attendanceServive.generateUserAttendances(_date);
      console.log(result ? `${_date}logs update successed!` : "Logs update failed!");
    }
    catch (err) {
      console.log(err);
    }
  });

  schedule.scheduleJob("0 10 12 * * *", async () => {
    let reportService = new ReportService();
    let users = await reportService.getNotCommitReportUsers();
    for (let user of users) {
      SMSApi.sendNotCommitReportSMS(user, moment().format("YYYY-MM-DD"));
    }
  });
}


app.listen(config.server.port, async () => {
  await init();
  await schedules();
  console.log(`App listening on port ${config.server.port}.`);
})