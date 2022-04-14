import moment from "moment";
import SMSApi from "../apis/smsApi";
import { AttendanceCheckType } from "../constants";
import FileData from "../core/filedata";
import { unique } from "../utils";
import DingTalkService from "./dingTalk.service";

export default class ReportService {
    private dingTalkService: DingTalkService;
    constructor() {
        this.dingTalkService = new DingTalkService();
    }

    async getNotCommitReportUsers() {
        const startTime = moment().format("YYYY-MM-DD 09:00:00");
        const endTime = moment().format("YYYY-MM-DD 21:00:00");

        const users = await FileData.readUsers();
        const userIds = users.map(x => parseInt(x.id));

        // 当天应交日报的员工id
        const usersAttendanceList = await this.dingTalkService.getAttendanceList(userIds, startTime, endTime);
        const offDutyAttendance = usersAttendanceList
            .filter((punch) => punch.check_type === AttendanceCheckType.OffDuty)
            .map((item) => item.userId);

        const cursor = 0;
        let reports = await this.dingTalkService.getAllReports(startTime, endTime, cursor);
        // 所有已交日报员工的id(去除重复提交的日报)
        let allReportedUserIds = reports.map((report) => report.creator_id);
        allReportedUserIds = unique<string>(allReportedUserIds)

        console.log(allReportedUserIds);
        console.log("OffDuty count " + offDutyAttendance.length);
        console.log("Commited report count " + allReportedUserIds.length);

        // 未交日报员工
        let noReportUserIds = offDutyAttendance.filter((item: string) => !allReportedUserIds.includes(item));

        // 未交日志并且订阅日志提醒的用户
        let noReportUsers = users.filter(x => noReportUserIds.includes(x.id) && x.phone);
        return noReportUsers;
    }
}