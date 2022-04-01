import fetch from 'node-fetch';
import moment from 'moment';
import Core from '@alicloud/pop-core';
import { apikey, apisecret, accessKeyId, accessKeySecret, users } from '../config';

interface User {
    name: string,
    phone: string | undefined
}

export default class DingAPI {
    token: string;
    constructor(token: string) {
        this.token = token;
    }
    // 获取日报
    getReport = async (startTime: string, endTime: string, cursor: number) => {
        const body = {
            "cursor": cursor,
            "start_time": new Date(startTime).getTime(),
            "template_name": ["TIMESHEET", "日报"],
            "size": 20,
            "end_time": new Date(endTime).getTime(),
        }
        const response = await fetch(`https://oapi.dingtalk.com/topapi/report/simplelist?access_token=${this.token}`, {
            method: 'POST',
            body: JSON.stringify(body)
        }).then(res => res.json());
        return response.result;
    }

    // 获取打卡记录
    getPunchIn = async (userIDList: number[], startTime: string, endTime: string) => {
        const bodyData = {
            "workDateFrom": startTime,
            "offset": 0,
            "userIdList": userIDList,
            "limit": 50,
            "isI18n": false,
            "workDateTo": endTime,
        };
        const punchIn = await fetch(`https://oapi.dingtalk.com/attendance/list?access_token=${this.token}`, {
            method: 'POST',
            body: JSON.stringify(bodyData)
        }).then(res => res.json());
        return punchIn.recordresult;
    }

    // 获取员工id
    getUserIDs = async (dept_id: number) => {
        const userInfo = await fetch(`https://oapi.dingtalk.com/topapi/user/listid?access_token=${this.token}`, {
            method: 'POST',
            body: JSON.stringify({
                dept_id
            })
        }).then(res => res.json());
        return userInfo.result?.userid_list;
    }

    // 获取部门
    getDepartments = async () => {
        const departments = await fetch(`https://oapi.dingtalk.com/topapi/v2/department/listsub?access_token=${this.token}`, {
            method: 'POST',
        }).then(res => res.json());
        return departments.result;
    }

    /**
     * 获取子部门
     * @param parentID 父部门id
     * @returns 
     */
    getChildrenDepartments = async (parentID: number) => {
        const childrenDepartments = await fetch(`https://oapi.dingtalk.com/topapi/v2/department/listsubid?access_token=${this.token}`, {
            method: 'POST',
            body: JSON.stringify({
                dept_id: parentID
            })
        }).then(res => res.json());
        return childrenDepartments?.result?.dept_id_list;
    }
    
    // 获取请假员工
    getOnLeaves = async (userIDs: string[], startTime: string, endTime: string) => {
        const leavesUsers = await fetch(`https://oapi.dingtalk.com/topapi/attendance/getleavestatus?access_token=${this.token}`, {
            method: 'POST',
            body: JSON.stringify({
                "start_time": startTime,
                "offset": 0,
                "size": 10,
                "end_time": endTime,
                "userid_list": userIDs.join()
            })
        }).then(res => res.json());
        return leavesUsers.result?.leave_status;
    }
    
    // 获取员工详情
    getUserDetail = async (userID: string) => {
        const leavesUsers = await fetch(`https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${this.token}`, {
            method: 'POST',
            body: JSON.stringify({
                "userid": userID
            })
        }).then(res => res.json());
        return leavesUsers.result?.name;
    }
    
    // 获取员工电话号码
    getUserPhoneNumber = async (unionID: string) => {
        const leavesUsers = await fetch(`https://api.dingtalk.com/v1.0/contact/users/${unionID}`, {
            headers: {
                'x-acs-dingtalk-access-token': this.token as any
            }
        }).then(res => res.json());
        return leavesUsers;
    }
    
    
    // 发送短信
    sendSms = async (user: User, endTime: string) => {
        if (!user.phone) return;
        var client = new Core({
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
            endpoint: 'https://dysmsapi.aliyuncs.com',
            apiVersion: '2017-05-25'
        });
    
        var params = {
            "SignName": "丰杰",
            "TemplateCode": "SMS_237560890",
            "PhoneNumbers": user.phone,
            "TemplateParam": `{\"name\":\"${user.name}\", \"date\": \"${moment(endTime).format('YYYY-MM-DD')}\"}`
        }
    
        var requestOption = {
            method: 'POST'
        };
    
        client.request('SendSms', params, requestOption).then((result) => {
            // console.log(JSON.stringify(result));
            console.log('短信发送成功');
        }, (ex) => {
            console.log(ex);
            console.log('短信发送失败');
        })
    }
}