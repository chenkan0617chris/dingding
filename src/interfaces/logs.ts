import { LogState } from "../constants";

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