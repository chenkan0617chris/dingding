export interface IUser {
    id: string;
    unionid: string;
    name: string;
    dept_name?: string;
    dept_id_list?: number[];
    phone?: string;
}

export interface IUserLogs {
    id: string;
    dept_name: string;
    name: string;
    logs?: ILogs[][];
}

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

export interface ILogs {
    state: LogState;
    value?: any;
}