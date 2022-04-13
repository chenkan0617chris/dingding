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