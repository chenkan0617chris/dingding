import { AttendanceCheckType, LogState, TimeResultType } from "../constants";
import { IDingTalkBaseResult } from "./base";

export interface IUserLogs {
    id: string;
    dept_name: string;
    name: string;
    logs?: ILogs[][];
}

export interface ILogs {
    state: LogState;
    value?: any;
}

export interface IAttendanceListResult {
    errcode: number;
    recordresult: IAttendanceRecordResult[],
    hasMore: false,
    errmsg: string;
}

export interface IUserAttendanceRecordResult {
    check_type: AttendanceCheckType,
    plan_check_time: string,
    user_check_time: string,
    time_result: TimeResultType;
    userId: string;
}

export interface IAttendanceRecordResult {
    checkType: AttendanceCheckType,
    planCheckTime: string,
    userCheckTime: string,
    timeResult: TimeResultType;
    userId: string;
}

export interface IUserAttendanceResult extends IDingTalkBaseResult<IUserAttendance> { }

export interface IUserAttendance {
    attendance_result_list: IUserAttendanceRecordResult[]
    approve_list: any[],
    corpId: string;
    work_date: string;
    userid: string;
    check_record_list: IRecordList[]
}

export interface IAttendanceLeaveResult extends IDingTalkBaseResult<IAttendanceLeave> { }

export interface IAttendanceLeave {
    columns: IAttendanceLeaveColumn[];
}

interface IAttendanceLeaveColumn {
    columnvals: IAttendanceLeaveColumnColumnval[];
    columnvo: IAttendanceLeaveColumnColumnvo;
}

interface IAttendanceLeaveColumnColumnvo {
    alias: string;
    name: string;
    status: number;
    sub_type: number;
    type: number;
}

interface IAttendanceLeaveColumnColumnval {
    date: string;
    value: string;
    name: string;
}

interface IRecordList {
    checkType: string;
    locationResult: string;
    baseCheckTime: number;
    groupId: number;
    timeResult: string;
    userId: string;
    recordId: number;
    workDate: number;
    sourceType: string;
    userCheckTime: number;
    planId: number;
    id: number;
}