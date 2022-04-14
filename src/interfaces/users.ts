import { IDingTalkBaseResult } from "./base";

export interface ICleanUser {
    current: number;
    next: number;
    users: string[];
}

export interface IUser {
    id: string;
    unionid: string;
    name: string;
    dept_name?: string;
    dept_id_list?: string[];
    phone?: string;
}

export interface IDingTalkUserResult extends IDingTalkBaseResult<IDingTalkUser> { }

export interface IDingTalkUser {
    userid: string;
    name: string;
    unionid: string;
    dept_id_list: string[]
}

export interface IDingTalkUserListIdResult extends IDingTalkBaseResult<IDingTalkUserIdList> { }

export interface IDingTalkUserIdList {
    userid_list: string[];
}