export interface IDingTalkBaseResult<T> {
    errcode: number;
    errmsg: string;
    request_id: string;
    result: T;
}

export interface IDingTalkTokenResponseResult {
    access_token: string;
}