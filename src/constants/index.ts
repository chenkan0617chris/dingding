/**
 * 正常 O 1
 * 调休 C 2
 * 休假 V 3
 * 事假 P 4
 * 病假 S 5
 * 未提交日志 X 6
 * 加班 J 7
 * 迟到 L 8
 */
export enum LogState {
    "O" = 1,
    "C" = 2,
    "V" = 3,
    "P" = 4,
    "S" = 5,
    "X" = 6,
    "J" = 7,
    "L" = 8
}

export enum AttendanceCheckType {
    "OnDuty" = "OnDuty", // 上班
    "OffDuty" = "OffDuty" // 下班
}

export enum TimeResultType {
    "Normal" = "Normal", //正常
    "Late" = "Late", // 迟到
    "Early" = "Early", // 早退
}