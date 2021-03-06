import moment from "moment";
import DingTalkApi from "../apis/dingTalkApi";
import { AttendanceCheckType, LogState, TimeResultType } from "../constants";
import FileData from "../core/filedata";
import { ILogs, IUser, IUserLogs } from "../interfaces";
import { vacationToEnum } from "../utils";

interface ITimes {
    start: string;
    end: string;
    work: string;
}
export default class AttendanceService {
    private dingTalkApi: DingTalkApi;
    private holidays: string[];
    private tiems: ITimes;
    private user: IUser;
    private logs: ILogs[];

    constructor() {
        this.dingTalkApi = new DingTalkApi();
    }

    private initUserLogs(users: IUser[], userLogs: IUserLogs[], days: number) {
        let _users = [...users], _userLogs = [...userLogs];
        if (_userLogs.length !== _users.length) {
            // to do 可优化
            _userLogs = _users.map(user => {
                let _userlog = _userLogs.find(x => x.name);
                return {
                    id: user.id,
                    name: user.name,
                    dept_name: user.dept_name,
                    logs: _userlog ? _userlog.logs : Array.from(new Array(days), () => [])
                }
            });
            return _userLogs;
        }
        return _userLogs;
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
    private prepareAttendanceDates(date, day = 8): string[] {
        let dates = [];
        while (day) {
            dates.push(moment(date).add(-dates.length, "days").format("YYYY-MM-DD"));
            --day;
        }
        return dates.reverse();
    }


    async generateUserAttendances(date, day = 8, name?: string) {
        let dates = this.prepareAttendanceDates(date, day);
        const firstDate = dates[0];
        const year = moment(firstDate).format("YYYY"),
            month = moment(firstDate).format("YYYY-MM"),
            days = moment(firstDate).daysInMonth();

        const users = await FileData.readUsers();
        this.holidays = await FileData.readHolidays(year);
        let userLogs = await FileData.readLogs(month);

        // 新增用户初始化logs（logs实际是考勤记录，修改成本太大一直沿用）
        userLogs = this.initUserLogs(users, userLogs, days);
        for (let d of dates) {
            let isHoliday = this.holidays.includes(d);
            for (let user of users) {
                if (name && user.name != name) {
                    continue;
                }
                let currentIndex = userLogs.findIndex(ul => ul.name === user.name);
                let index = parseInt(moment(d).format("D")) - 1;
                // 节假日
                if (isHoliday) {
                    userLogs[currentIndex].logs[index] = [];
                } else {
                    this.tiems = {
                        start: `${d} 00:00:00`,
                        end: `${d} 23:59:59`,
                        work: `${d} 09:00:00`
                    }
                    this.user = user;
                    this.logs = [];
                    await this.getUserAttendanceByTimeName();
                    await this.getUserReportLog();
                    await this.getUserAttendanceLog();
                    userLogs[currentIndex].logs[index] = this.logs;
                }
            }
        }
        return await FileData.writeLogs(month, userLogs);
    }

    /**
     * 
     * @param date 
     */
    private findNextNotHolodayDate(date) {
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
    private async whetherLeaveOneDay() {
        return await this.getLeaveTimeByMinutes() >= (7.5 * 60);
    }

    private async getLeaveTimeByMinutes() {
        const leaveType = [LogState.C, LogState.P, LogState.S, LogState.V];
        const leaveLog = this.logs.filter(x => leaveType.includes(x.state));
        return leaveLog.length > 0 ? parseFloat(leaveLog[0].value) * 60 : 0;
    }

    /**
    * 日志记录 
    */
    private async getUserReportLog() {
        if (await this.whetherLeaveOneDay()) { return; }
        const { date } = this.findNextNotHolodayDate(moment(this.tiems.start).format("YYYY-MM-DD"));
        const startTime = moment(this.tiems.start).format("YYYY-MM-DD 09:00:01");
        const endTime = moment(date).format("YYYY-MM-DD 08:59:59");
        let reports = await this.dingTalkApi.getReports(startTime, endTime, 0, this.user.id);
        if (reports.data_list.length === 0) {
            this.logs.push({
                state: LogState.X
            })
        }
    }

    // 统一请假时长单位
    private unifyLeaveTime(name, value) {
        const names = ["丧假", "年假"];
        if (names.includes(name)) {
            return parseFloat(value) * 7.5;
        }
        return value;
    }

    /**
     * 请假记录
     */
    private async getUserAttendanceByTimeName() {
        const types = ["调休", "事假", "病假", "年假", "产假", "陪产假", "婚假", "例假", "丧假", "特别假"];
        let data = await this.dingTalkApi.getUserAttendanceLeaveTimeByNames(this.user.id, types.join(","), this.tiems.start, this.tiems.end);
        for (let d of data?.columns) {
            if (d.columnvals[0].value != "null" && d.columnvals[0].value != "0.0") {
                this.logs.push({
                    state: vacationToEnum(d.columnvo.name),
                    value: this.unifyLeaveTime(d.columnvo.name, d.columnvals[0].value)
                })
            }
        }
    }

    // 上班下班记录
    private async getUserAttendanceLog() {
        const attendance = await this.dingTalkApi.getUserAttendance(this.user.id, this.tiems.work);
        let _logs = { state: LogState.O, value: 0 };
        let subTime = 0;
        let userOffDutyTime = moment(this.tiems.work);

        // 请假一天直接返回
        if (await this.whetherLeaveOneDay()) {
            return;
        }

        // 新入职员工没有打卡记录 （不严谨）
        if (attendance.attendance_result_list.length === 0) {
            this.logs = [];
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