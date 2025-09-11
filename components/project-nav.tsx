import Link from "next/link"
import { Search, Star, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useQuery, useMutation } from "@apollo/client";
import { GET_PROJECTS, GET_PROJECTS_BY_IDS, UPDATE_USER_FAVOURITE_PROJECTS } from "@/queries/queries";
import { useEffect, useState, useContext } from "react";
import { TruncatedText } from "./truncated-text";
import { useParams, usePathname } from "next/navigation";
import { Skeleton } from "./ui/skeleton";
import { UserContext } from "@/app/(application)/authenticated";
import { User } from "@/types/models/user";
import { CreateProjectDialog } from "./create-project-dialog";
import { useRouter } from "next/router";

// Project interface based on our schema
interface Project {
  id: string;
  name: string;
  description?: string;
  image?: string;
  custom_instructions?: string;
  rights_mode?: string;
  created_by?: number;
  createdAt?: string;
  updatedAt?: string;
  RBAC?: any;
}

export function ProjectNav() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const pathname = usePathname();
  const { user: init } = useContext(UserContext);
  const [user, setUser] = useState<User>(init);

  // Fetch favourite projects using GET_PROJECTS_BY_IDS
  const favouriteProjects = useQuery(GET_PROJECTS_BY_IDS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      ids: user?.favourite_projects || []
    },
    skip: !user?.favourite_projects?.length,
  });

  // Fetch regular projects (excluding favourites when not searching)
  const projects = useQuery(GET_PROJECTS, {
    fetchPolicy: "no-cache",
    nextFetchPolicy: "network-only",
    variables: {
      page: 1,
      limit: 200,
      filters: searchQuery ? [
        {
          name: {
            contains: searchQuery
          }
        }
      ] : undefined,
    },
  });

  useEffect(() => {
    projects.refetch();
  }, [pathname]);

  const [updateUserFavouriteProjects] = useMutation(UPDATE_USER_FAVOURITE_PROJECTS);

  const renderProjectImage = (project: Project) => {
    if (project.image) {
      return (
        <img
          src={project.image}
          alt={`${project.name} thumbnail`}
          className="h-4 w-4 rounded-full object-cover"
        />
      );
    } else {
      return (
        <div className="h-4 w-4 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium">
          {project.name?.charAt(0).toUpperCase() || 'P'}
        </div>
      );
    }
  };

  const handleFavouriteToggle = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const currentFavorites = user?.favourite_projects || [];
      const isFavorite = currentFavorites.includes(projectId);

      let newFavorites: string[];
      if (isFavorite) {
        newFavorites = currentFavorites.filter(id => id !== projectId);
      } else {
        newFavorites = [...currentFavorites, projectId];
      }

      await updateUserFavouriteProjects({
        variables: {
          id: user?.id,
          favourite_projects: newFavorites
        }
      });

      setUser(prev => ({ ...prev, favourite_projects: newFavorites }));
    } catch (error) {
      console.error("Error updating favourite projects:", error);
    }
  };

  const handleCreateProject = () => {
    setCreateDialogOpen(true);
  };

  const allProjects = (projects?.data?.projectsPagination?.items || projects?.previousData?.projectsPagination?.items) || [];
  const favoriteProjectsList = (favouriteProjects?.data?.projectByIds || favouriteProjects?.previousData?.projectByIds) || [];

  return (
    <div className="h-full w-[250px] flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="lg"
          className="h-10 w-10 p-0"
          onClick={handleCreateProject}
          title="Create new project"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto space-y-1">

        <>
          {user?.favourite_projects && favoriteProjectsList.length > 0 && !searchQuery && (
            <>
              <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                Favorites
              </div>
              {favouriteProjects.loading && (
                <>
                  <Skeleton className="w-[100%] h-[32px] rounded-lg" />
                  <Skeleton className="w-[100%] h-[32px] rounded-lg" />
                </>
              )}
              {!favouriteProjects.loading && (() => {
                return (
                  <>
                    {favoriteProjectsList.map((project: Project) => (
                      <div key={project.id} className="flex items-center gap-1">
                        <Link href={`/projects/${project.id}`} className="flex-1">
                          <Button
                            variant={pathname.includes(project.id) ? "secondary" : "ghost"}
                            className="w-full justify-start gap-2 pr-1"
                          >
                            {renderProjectImage(project)}
                            <span className="flex-1 text-left">
                              <TruncatedText text={project.name} length={10} />
                            </span>
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0"
                          onClick={(e) => handleFavouriteToggle(project.id, e)}
                        >
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        </Button>
                      </div>
                    ))}
                  </>
                );
              })()}
            </>
          )}

          <div className="text-xs font-medium text-muted-foreground px-2 py-1 mt-2">
            All projects:
          </div>

          {projects.loading && (
            <>
              <Skeleton className="w-[100%] h-[32px] rounded-lg" />
              <Skeleton className="w-[100%] h-[32px] rounded-lg" />
              <Skeleton className="w-[100%] h-[32px] rounded-lg" />
            </>
          )}

          {!projects.loading && allProjects.map((project: Project) => (
            <div key={project.id} className="flex items-center gap-1">
              <Link href={`/projects/${project.id}`} className="flex-1">
                <Button
                  variant={pathname.includes(project.id) ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 pr-1"
                >
                  {renderProjectImage(project)}
                  <span className="flex-1 text-left">
                    <TruncatedText text={project.name} length={14} />
                  </span>
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={(e) => handleFavouriteToggle(project.id, e)}
              >
                <Star className={`h-3 w-3 ${user?.favourite_projects?.includes(project.id) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
            </div>
          ))}
        </>
      </div>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        refetchProjects={projects.refetch}
      />
    </div>
  );
}