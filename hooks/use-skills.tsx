import { useMutation, useQuery } from "@apollo/client";
import {
  CREATE_SKILL,
  DELETE_SKILL,
  GET_SKILL_BY_ID,
  GET_SKILLS,
  UPDATE_SKILL,
} from "@/queries/queries";
import { CreateSkillInput, Skill, UpdateSkillInput } from "@/types/models/skill";

interface SkillsData {
  skillsPagination: {
    pageInfo: {
      pageCount: number;
      itemCount: number;
      currentPage: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
    items: Skill[];
  };
}

interface SkillData {
  skillById: Skill;
}

export const useSkills = (variables?: {
  page?: number;
  limit?: number;
  filters?: any[];
  sort?: { field: string; direction: "ASC" | "DESC" };
}) => {
  return useQuery<SkillsData>(GET_SKILLS, {
    variables: {
      page: variables?.page ?? 1,
      limit: variables?.limit ?? 50,
      filters: variables?.filters ?? [],
      sort: variables?.sort ?? { field: "updatedAt", direction: "DESC" },
    },
  });
};

export const useSkill = (id: string) => {
  return useQuery<SkillData>(GET_SKILL_BY_ID, {
    variables: { id },
    skip: !id,
  });
};

export const useCreateSkill = () => {
  return useMutation<{ skillsCreateOne: { item: Skill } }>(CREATE_SKILL, {
    refetchQueries: [{ query: GET_SKILLS, variables: { page: 1, limit: 50 } }],
  });
};

export const useUpdateSkill = () => {
  return useMutation<{ skillsUpdateOneById: { item: Skill } }>(UPDATE_SKILL);
};

export const useDeleteSkill = () => {
  return useMutation<{ skillsRemoveOneById: { id: string } }>(DELETE_SKILL, {
    refetchQueries: [{ query: GET_SKILLS, variables: { page: 1, limit: 50 } }],
  });
};
