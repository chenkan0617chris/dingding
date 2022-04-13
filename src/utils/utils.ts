import { LogState } from "../interfaces/logs";
import moment from "moment";

export default {
    unique,
    formatDate,
    vacationToEnum
}

/**
 * 简单数组去重 eg: [1,2,2] / ["1","2","2"]
 * */
export function unique<T>(arr) {
    return <T[]>Array.from(new Set(arr));
}

export function formatDate(date: moment.Moment | number | string, format = "YYYY-MM-DD HH:mm:ss") {
    if (typeof date === "number" || typeof date === "string") {
        date = moment(date);
    }
    return date.format(format);
}

export function vacationToEnum(name) {
    switch (name) {
        case "调休": return LogState.C;
        case "休假": return LogState.V;
        case "事假": return LogState.P;
        case "病假": return LogState.S
        default: return LogState.P;
    }
}