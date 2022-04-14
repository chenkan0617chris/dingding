import config from "config";
interface IConfig {
    server: {
        port: number;
    }
    dingTalk: {
        bossId: string;
        apikey: string;
        apisecret: string;
        apiUrl: string;
        v1ApiUrl: string;
        v2ApiUrl: string;
    }
    aliSms: {
        accessKeyId: string;
        accessKeySecret: string;
        endpoint: string;
        apiVersion: string;
    }
    smsTemplate: {
        code: string;
        signName: string;
    }
}

export default <IConfig>{
    server: {
        port: config.get("server.port")
    },
    dingTalk: {
        bossId: config.get("dingTalk.bossId"),
        apikey: config.get("dingTalk.apikey"),
        apisecret: config.get("dingTalk.apisecret"),
        apiUrl: config.get("dingTalk.apiUrl"),
        v1ApiUrl: config.get("dingTalk.v1ApiUrl"),
        v2ApiUrl: config.get("dingTalk.v2ApiUrl"),
    },
    aliSms: {
        accessKeyId: config.get("aliSms.accessKeyId"),
        accessKeySecret: config.get("aliSms.accessKeySecret"),
        endpoint: config.get("aliSms.endpoint"),
        apiVersion: config.get("aliSms.apiVersion"),
    },
    smsTemplate: {
        code: config.get("smsTemplate.code"),
        signName: config.get("smsTemplate.signName")
    }
}