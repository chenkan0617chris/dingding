export enum AttendanceCheckType {
    "OnDuty" = "OnDuty", // 上班
    "OffDuty" = "OffDuty" // 下班
}

export enum TimeResultType {
    "Normal" = "Normal", //正常
    "Late" = "Late", // 迟到
    "Early" = "Early", // 早退
}

export interface IAttendanceResult {
    check_type: AttendanceCheckType,
    plan_check_time: string,
    user_check_time: string,
    time_result: TimeResultType;
}

export interface IAttendance {
    attendance_result_list: IAttendanceResult[]
    approve_list: any[],
}

export interface IAttendanceLeave {
    columns: Column[];
}

interface Column {
    columnvals: Columnval[];
    columnvo: Columnvo;
}

interface Columnvo {
    alias: string;
    name: string;
    status: number;
    sub_type: number;
    type: number;
}

interface Columnval {
    date: string;
    value: string;
    name: string;
}