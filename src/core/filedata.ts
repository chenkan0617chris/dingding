import fs from "fs";
import { ICleanUser, IUser } from "../interfaces/users";
import moment from "moment";
import { IUserLogs } from "../interfaces/logs";

export default class FileData {
    static async generateEmtpyLogs(days, type = "default") {
        const users = await FileData.readUsers();
        return users.map(x => {
            return {
                id: x.id,
                dept_name: x.dept_name,
                name: x.name,
                logs: Array.from(new Array(days), () => type === "default" ? [] : null)
            }
        });
    }

    static readLogs = async (fileName: string) => {
        try {
            const data = await fs.readFileSync(`./data/${fileName}.json`, { encoding: "utf-8" });
            return <IUserLogs[]>JSON.parse(data);
        } catch {
            const userlogs = await FileData.generateEmtpyLogs(moment(fileName).daysInMonth());
            await FileData.writeLogs(userlogs, fileName);
            return userlogs;
        }
    }

    static writeLogs = async (logs: IUserLogs[], fileName: string) => {
        try {
            await fs.writeFileSync(`./data/${fileName}.json`, JSON.stringify(logs), { encoding: "utf-8" });
            return true;
        } catch {
            return false;
        }
    }

    static readCustomLogs = async (fileName: string) => {
        let _fileName = fileName + "-custom";
        try {
            const data = await fs.readFileSync(`./data/${_fileName}.json`, { encoding: "utf-8" });
            return <IUserLogs[]>JSON.parse(data);
        } catch {
            const userlogs = await FileData.generateEmtpyLogs(moment(fileName).daysInMonth(), "Custom");
            await FileData.writeCustomLogs(userlogs, fileName);
            return userlogs;
        }
    }

    static writeCustomLogs = async (logs: IUserLogs[], fileName: string) => {
        let _fileName = fileName + "-custom";
        try {
            await fs.writeFileSync(`./data/${_fileName}.json`, JSON.stringify(logs), { encoding: "utf-8" });
            return true;
        } catch {
            return false;
        }
    }

    static readUsers = async () => {
        const data = await fs.readFileSync("./data/users.json", { encoding: "utf-8" });
        return <IUser[]>JSON.parse(data);
    }

    static writeUsers = async (users: string) => {
        return await fs.writeFileSync("./data/users.json", users, { encoding: "utf-8" });
    }

    static readHolidays = async (year: string): Promise<string[]> => {
        const holodays = await fs.readFileSync(`./data/${year}-holiday.json`, { encoding: "utf-8" });
        return <string[]>JSON.parse(holodays);
    }

    static readCleanUsers = async (): Promise<ICleanUser> => {
        const holodays = await fs.readFileSync(`./data/clean-users.json`, { encoding: "utf-8" });
        return <ICleanUser>JSON.parse(holodays);
    }
}
