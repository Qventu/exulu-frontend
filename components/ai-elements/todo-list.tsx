'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import type { ComponentProps } from 'react';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  id: string;
}

export interface TodoListProps extends ComponentProps<'div'> {
  todos: TodoItem[];
  showPriority?: boolean;
  state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
}

const statusConfig = {
  pending: {
    icon: Circle,
    label: 'Pending',
    className: 'text-muted-foreground',
  },
  in_progress: {
    icon: Loader2,
    label: 'In Progress',
    className: 'text-blue-500 animate-spin',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    className: 'text-green-500',
  },
  cancelled: {
    icon: XCircle,
    label: 'Cancelled',
    className: 'text-red-500',
  },
};

const priorityConfig = {
  high: {
    label: 'High',
    className: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  medium: {
    label: 'Medium',
    className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
  low: {
    label: 'Low',
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
};

export const TodoList = ({
  todos,
  showPriority = false,
  state,
  className,
  ...props
}: TodoListProps) => {

  if (typeof todos === 'string') {
    todos = JSON.parse(todos);
  }

  if (!todos || todos.length === 0) {
    return null;
  }

  const isStreaming = state === 'input-streaming';
  const hasError = state === 'output-error';
  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const totalCount = todos.length;

  return (
    <div
      className={cn(
        'my-2 space-y-1',
        isStreaming && 'opacity-70',
        className
      )}
      {...props}
    >
      {todos.map((todo, index) => {
        const StatusIcon = statusConfig[todo.status].icon;
        const statusClass = statusConfig[todo.status].className;
        const priorityClass = priorityConfig[todo.priority].className;
        const isLastInProgress = todo.status === 'in_progress' &&
          index === todos.findIndex(t => t.status === 'in_progress');

        return (
          <div
            key={todo.id}
            className={cn(
              'flex items-start gap-2 py-0.5',
              todo.status === 'cancelled' && 'opacity-50'
            )}
          >
            <div className="flex-shrink-0 pt-0.5">
              <StatusIcon className={cn('size-3.5', statusClass)} />
            </div>

            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  'text-sm',
                  todo.status === 'completed' && 'text-muted-foreground line-through',
                  todo.status === 'cancelled' && 'text-muted-foreground line-through',
                  todo.status === 'in_progress' && isLastInProgress && 'font-medium'
                )}
              >
                {todo.content}
              </span>

              {showPriority && todo.priority === 'high' && (
                <span className="ml-2 text-red-500 text-xs">(!)</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Compact progress indicator */}
      {totalCount > 1 && (
        <div className="flex items-center gap-2 pt-1 text-muted-foreground text-xs">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${(completedCount / totalCount) * 100}%`,
              }}
            />
          </div>
          <span className="whitespace-nowrap">
            {completedCount}/{totalCount}
          </span>
        </div>
      )}

      {hasError && (
        <div className="flex items-center gap-1 pt-1 text-red-500 text-xs">
          <XCircle className="size-3" />
          <span>Error updating tasks</span>
        </div>
      )}
    </div>
  );
};

export type TodoItemProps = ComponentProps<'div'> & {
  todo: TodoItem;
  showPriority?: boolean;
  state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
};

export const TodoItemComponent = ({
  todo,
  showPriority = false,
  state,
  className,
  ...props
}: TodoItemProps) => {
  const StatusIcon = statusConfig[todo.status].icon;
  const statusClass = statusConfig[todo.status].className;
  const isStreaming = state === 'input-streaming';

  return (
    <div
      className={cn(
        'flex items-start gap-2 py-0.5',
        todo.status === 'cancelled' && 'opacity-50',
        isStreaming && 'opacity-70',
        className
      )}
      {...props}
    >
      <div className="flex-shrink-0 pt-0.5">
        <StatusIcon className={cn('size-3.5', statusClass)} />
      </div>

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'text-sm',
            todo.status === 'completed' && 'text-muted-foreground line-through',
            todo.status === 'cancelled' && 'text-muted-foreground line-through',
            todo.status === 'in_progress' && 'font-medium'
          )}
        >
          {todo.content}
        </span>

        {showPriority && todo.priority === 'high' && (
          <span className="ml-2 text-red-500 text-xs">(!)</span>
        )}
      </div>
    </div>
  );
};
