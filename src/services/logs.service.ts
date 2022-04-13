import { AttendanceCheckType, TimeResultType } from "../interfaces/attendance";
import { ILogs, IUser, LogState } from "../interfaces/logs";
import moment from "moment";
import DingdingApi from "../apis/dingdingApi"
import * as utils from "../utils/utils";
import { LeaveDurationUnitType } from "../interfaces/leave";
import FileData from "../core/filedata";

interface ITimes {
    start: string;
    end: string;
    work: string;
}


interface IMonth {
    start: string;
    end: string;
}

export default class LogService {
    dingApi: DingdingApi;
    holidays: string[];
    user: IUser;
    tiems: ITimes;
    logs: ILogs[];
    month: IMonth;

    constructor(dingApi: DingdingApi, times: ITimes, holidays: string[]) {
        this.dingApi = dingApi;
        this.tiems = times;
        this.holidays = holidays;
    }

    async build(user: IUser) {
        this.user = user;
        this.logs = [];
        if (this.tiems.start || this.tiems.end || this.tiems.work) { }
        await this.getUserReportLog();
        await this.getUserAttendanceByTimeName();
        await this.getUserAttendanceLog();
    }


    async getOnLeaves() {
        const leaveData = await this.dingApi.getOnLeaves([this.user.id], new Date(this.tiems.start).getTime(), new Date(this.tiems.end).getTime());
        for (let value of leaveData) {
            if (value.duration_unit === LeaveDurationUnitType.percent_day) {

            }
        }
    }

    findNextNotHolodayDate(date) {
        let tomorrowDate = moment(date).add(1, "days").format("YYYY-MM-DD");
        let isHoliday = false;
        while (this.holidays.includes(tomorrowDate)) {
            isHoliday = true;
            tomorrowDate = moment(tomorrowDate).add(1, "days").format("YYYY-MM-DD");
        }
        return {
            date: tomorrowDate,
            isHoliday: isHoliday
        };
    }

    // 是否请假一天
    async whetherLeaveOneDay() {
        return await this.getLeaveTimeByMinutes() >= (7.5 * 60);
    }

    async getLeaveTimeByMinutes() {
        const leaveType = [LogState.C, LogState.P, LogState.S, LogState.V];
        const leaveLog = this.logs.filter(x => leaveType.includes(x.state));
        return leaveLog.length > 0 ? parseFloat(leaveLog[0].value) * 60 : 0;
    }

    /**
     * 日志记录 
     */
    async getUserReportLog() {
        const { date, isHoliday } = this.findNextNotHolodayDate(moment(this.tiems.start).format("YYYY-MM-DD"));
        const endTime = moment(date).format("YYYY-MM-DD 09:00:00");
        const startTime = moment(this.tiems.start).format("YYYY-MM-DD 09:00:01");
        const reports = await this.dingApi.getReport(startTime, endTime, 0, this.user.id);
        if (reports.data_list.length === 0 && !this.whetherLeaveOneDay()) {
            this.logs.push({
                state: LogState.X
            })
        }
    }



    // 统一请假时长单位
    unifyLeaveTime(name, value) {
        const names = ["丧假"];
        if (names.includes(name)) {
            return parseFloat(value) * 7.5;
        }
        return value;
    }


    // 请假记录
    async getUserAttendanceByTimeName() {
        const types = ["调休", "事假", "病假", "年假", "产假", "陪产假", "婚假", "例假", "丧假", "特别假"];
        let data = await this.dingApi.getUserAttendanceTimeByNames(this.user.id, types.join(","), this.tiems.start, this.tiems.end);
        for (let d of data.columns) {
            if (d.columnvals[0].value != "null" && d.columnvals[0].value != "0.0") {
                this.logs.push({
                    state: utils.vacationToEnum(d.columnvo.name),
                    value: this.unifyLeaveTime(d.columnvo.name, d.columnvals[0].value)
                })
            }
        }
    }

    // 上班下班记录
    async getUserAttendanceLog() {
        const attendance = await this.dingApi.getUserAttendance(this.user.id, this.tiems.work);
        let _logs = { state: LogState.O, value: 0 };
        let subTime = 0;
        let userOffDutyTime = moment(this.tiems.work);

        // 请假一天直接返回
        if (await this.whetherLeaveOneDay()) {
            return;
        }

        // 新入职员工没有打卡记录 （不严谨）
        if (attendance.attendance_result_list.length === 0) {
            return;
        }

        for (let data of attendance.attendance_result_list) {
            if (data.check_type === AttendanceCheckType.OnDuty) {
                subTime = moment(data.plan_check_time).diff(moment(data.user_check_time), "minutes");
                if (data.time_result === TimeResultType.Late && subTime > 60) {
                    subTime += await this.getLeaveTimeByMinutes() + 90;
                }
            }
            else if (data.check_type === AttendanceCheckType.OffDuty) {
                // 获取用户上班信息
                let userOnDutyInfo = attendance.attendance_result_list.find(x => x.check_type === AttendanceCheckType.OnDuty);
                if (userOnDutyInfo) {
                    // 计算下班时间 9 = 中午午休1.5小时+上班7.5小时 默认下班时间当天18:00
                    userOffDutyTime = moment(userOnDutyInfo.user_check_time).add(9, "hours");
                    const defaultOffDutyTime = moment(userOffDutyTime).format("YYYY-MM-DD 18:00:00");
                    if (userOffDutyTime.diff(defaultOffDutyTime) > 0) {
                        userOffDutyTime = moment(defaultOffDutyTime);
                    }
                }
                subTime = moment(data.user_check_time).diff(userOffDutyTime, "minutes");
                if (data.time_result === TimeResultType.Early) {
                    subTime += await this.getLeaveTimeByMinutes() + 90;
                }
            }
            if (subTime < 0) {
                _logs.state = LogState.L;
                _logs.value += Math.abs(subTime);
            }
        }
        this.logs.push({
            state: _logs.state,
            value: _logs.state === LogState.O ? null : _logs.value
        });
    }
}