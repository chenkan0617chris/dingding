import { IDingTalkBaseResult } from "./base";

export interface DeptDetail {
  chain: string;
  contact_type: string;
  dept_id: number;
  dept_type: string;
  feature: string;
  name: string;
  nick: string;
}

export interface IDepartmentResult extends IDingTalkBaseResult<IDepartmentListsub[]> { }


export interface IDepartmentListsub {
  auto_add_user: boolean;
  create_dept_group: boolean;
  dept_id: string;
  name: string;
  parent_id: number;
}

export interface IDepartmentIdResult extends IDingTalkBaseResult<IDepartmentListsubId> { }

interface IDepartmentListsubId {
  dept_id_list: string[];
}