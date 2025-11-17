import { useMutation, useQuery } from "@apollo/client";
import {
  CREATE_PROMPT,
  CREATE_PROMPT_FAVORITE,
  DELETE_PROMPT,
  DELETE_PROMPT_FAVORITE,
  GET_PROMPT_BY_ID,
  GET_PROMPTS,
  GET_USER_PROMPT_FAVORITES,
  INCREMENT_PROMPT_FAVORITES,
  INCREMENT_PROMPT_USAGE,
  UPDATE_PROMPT,
} from "@/queries/queries";
import {
  CreatePromptInput,
  PromptFavorite,
  PromptLibrary,
  UpdatePromptInput,
} from "@/types/models/prompt-library";

interface PromptsData {
  prompt_libraryPagination: {
    pageInfo: {
      pageCount: number;
      itemCount: number;
      currentPage: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
    items: PromptLibrary[];
  };
}

interface PromptData {
  prompt_library_itemById: PromptLibrary;
}

interface PromptFavoritesData {
  prompt_favoritesPagination: {
    items: PromptFavorite[];
  };
}

/**
 * Hook to fetch paginated prompts with filtering and sorting
 */
export const usePrompts = (variables?: {
  page?: number;
  limit?: number;
  filters?: any[];
  sort?: { field: string; direction: "ASC" | "DESC" };
}) => {
  return useQuery<PromptsData>(GET_PROMPTS, {
    variables: {
      page: variables?.page ?? 1,
      limit: variables?.limit ?? 20,
      filters: variables?.filters ?? [],
      sort: variables?.sort ?? { field: "updatedAt", direction: "DESC" },
    },
  });
};

/**
 * Hook to fetch a single prompt by ID
 */
export const usePrompt = (id: string) => {
  return useQuery<PromptData>(GET_PROMPT_BY_ID, {
    variables: { id },
    skip: !id,
  });
};

/**
 * Hook to create a new prompt
 */
export const useCreatePrompt = () => {
  return useMutation<{ prompt_libraryCreateOne: { item: PromptLibrary } }>(
    CREATE_PROMPT,
    {
      refetchQueries: [{ query: GET_PROMPTS, variables: { page: 1, limit: 20 } }],
    }
  );
};

/**
 * Hook to update an existing prompt
 */
export const useUpdatePrompt = () => {
  return useMutation<{ prompt_libraryUpdateOneById: { item: PromptLibrary } }>(
    UPDATE_PROMPT
  );
};

/**
 * Hook to delete a prompt
 */
export const useDeletePrompt = () => {
  return useMutation<{ prompt_libraryRemoveOneById: { id: string } }>(
    DELETE_PROMPT,
    {
      refetchQueries: [{ query: GET_PROMPTS, variables: { page: 1, limit: 20 } }],
    }
  );
};

/**
 * Hook to increment prompt usage count
 */
export const useIncrementPromptUsage = () => {
  return useMutation<{
    prompt_libraryUpdateOneById: { item: Pick<PromptLibrary, "id" | "usage_count"> };
  }>(INCREMENT_PROMPT_USAGE);
};

/**
 * Hook to fetch user's favorited prompts
 */
export const useUserPromptFavorites = (userId: number) => {
  return useQuery<PromptFavoritesData>(GET_USER_PROMPT_FAVORITES, {
    variables: { user_id: userId },
    skip: !userId,
  });
};

/**
 * Hook to create a prompt favorite
 */
export const useCreatePromptFavorite = () => {
  return useMutation<{ prompt_favoritesCreateOne: { item: PromptFavorite } }>(
    CREATE_PROMPT_FAVORITE
  );
};

/**
 * Hook to delete a prompt favorite
 */
export const useDeletePromptFavorite = () => {
  return useMutation<{ prompt_favoritesRemoveOneById: { id: string } }>(
    DELETE_PROMPT_FAVORITE
  );
};

/**
 * Hook to toggle favorite status of a prompt
 * Handles both creating and deleting favorites, and updating the favorite count
 */
export const useTogglePromptFavorite = () => {
  const [createFavorite] = useCreatePromptFavorite();
  const [deleteFavorite] = useDeletePromptFavorite();
  const [incrementFavorites] = useMutation(INCREMENT_PROMPT_FAVORITES);

  const toggleFavorite = async (
    promptId: string,
    userId: number,
    isFavorited: boolean,
    currentFavoriteCount: number,
    favoriteId?: string
  ) => {
    if (isFavorited && favoriteId) {
      // Remove favorite
      await deleteFavorite({ variables: { id: favoriteId } });
      await incrementFavorites({
        variables: {
          id: promptId,
          favorite_count: Math.max(0, currentFavoriteCount - 1),
        },
      });
    } else {
      // Add favorite
      await createFavorite({
        variables: { user_id: userId, prompt_id: promptId },
      });
      await incrementFavorites({
        variables: { id: promptId, favorite_count: currentFavoriteCount + 1 },
      });
    }
  };

  return { toggleFavorite };
};
