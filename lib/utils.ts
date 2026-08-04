import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style class merger — preferred for any ui/ component. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
