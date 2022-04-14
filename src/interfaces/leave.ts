export interface ILeave {
    /**
     * 假期时长*100，例如用户请假时长为1天，该值就等于100。
     */
    duration_percent: number;
    duration_unit: LeaveDurationUnitType;
    end_time: number;
    leave_code: string;
    start_time: number;
    userid: string;
}

/**
 * percent_day：天
 * percent_hour：小时
 */
export enum LeaveDurationUnitType {
    percent_day,
    percent_hour
}