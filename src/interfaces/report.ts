import { IDingTalkBaseResult } from "./base";

export interface IReportResult {
    create_time: number;
    creator_id: string;
    creator_name: string;
}

export interface IReport {
    data_list: IReportResult[];
    has_more: boolean;
    next_cursor: number;
}

export interface IReportSimpleListResult extends IDingTalkBaseResult<IReportSimple> { }

export interface IReportSimple {
    data_list: IReportSimpleDatalist[];
    has_more: boolean;
    next_cursor: number;
    size: number;
}

export interface IReportSimpleDatalist {
    create_time: number;
    creator_id: string;
    creator_name: string;
    dept_name: string;
    remark: string;
    report_id: string;
    template_name: string;
}