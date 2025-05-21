import {
  CheckCircledIcon,
  CrossCircledIcon,
  StopwatchIcon,
    CheckboxIcon,
    ActivityLogIcon,
    ArchiveIcon
} from "@radix-ui/react-icons";
import {
  AlertTriangleIcon,
} from "lucide-react";
import {JOB_STATUS} from "@/util/enums/job-status";

export const statuses = [
  {
    value: JOB_STATUS.waiting,
    label: "Received",
    icon: ArchiveIcon,
  },
  {
    value: JOB_STATUS.waiting,
    label: "Queued",
    icon: ActivityLogIcon,
  },
  {
    value: JOB_STATUS.waiting,
    label: "Pending",
    icon: StopwatchIcon,
  },
  {
    value: JOB_STATUS.completed,
    label: "Completed",
    icon: CheckCircledIcon,
  },
  {
    value: JOB_STATUS.paused,
    label: "Cancelled",
    icon: CrossCircledIcon,
  },
  {
    value: JOB_STATUS.failed,
    label: "Error",
    icon: AlertTriangleIcon,
  },
  {
    value: JOB_STATUS.active,
    label: "Running",
    icon: StopwatchIcon,
  },
];