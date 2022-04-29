import { Server } from "socket.io";
import * as http from "http";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { ITimeSheetData } from "../interfaces";
import RedisHelper from "../core/redisHelper";
export default class SocketService {
    io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
    constructor(server: http.Server) {
        this.io = new Server(server, {
            serveClient: false,
            pingInterval: 10000,
            pingTimeout: 5000,
            cookie: false,
            cors: {
                origin: "*",
                allowedHeaders: "*"
            }
        });

        this.setTimeSheetSpace();
    }

    setTimeSheetSpace() {
        const TimeSheetSpace = "/timesheet";
        this.io.of(TimeSheetSpace).on("connection", async (socket) => {
            socket.on("sendMessage", async (data: ITimeSheetData) => {
                let datas = await RedisHelper.getByAsync<ITimeSheetData[]>("timesheets");
                if (datas === null) {
                    datas = [];
                }
                let _data = datas.find(x => x.name === data.name);

                if (_data) {
                    _data.value = data.value
                } else {
                    datas.push(data);
                }
                await RedisHelper.setAsync("timesheets", JSON.stringify(datas));
                socket.broadcast.emit("receiveMessage", data);
            });

            socket.on("error", () => {
                socket.disconnect();
            })
        });
    }
}