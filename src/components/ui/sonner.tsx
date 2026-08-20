import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      dir="ltr"
      className="toaster group"
      position="top-center"
      richColors
      expand
      duration={3500}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg !font-[inherit] !text-sm !rounded-xl !gap-3",
          title: "!font-semibold !text-[14px] !leading-snug",
          description: "group-[.toast]:text-muted-foreground !text-[13px]",
          success: "!bg-emerald-50 dark:!bg-emerald-950/40 !border-emerald-200 dark:!border-emerald-800 !text-emerald-800 dark:!text-emerald-300",
          error:   "!bg-red-50   dark:!bg-red-950/40   !border-red-200   dark:!border-red-800   !text-red-800   dark:!text-red-300",
          warning: "!bg-amber-50 dark:!bg-amber-950/40 !border-amber-200 dark:!border-amber-800 !text-amber-800 dark:!text-amber-300",
          info:    "!bg-blue-50  dark:!bg-blue-950/40  !border-blue-200  dark:!border-blue-800  !text-blue-800  dark:!text-blue-300",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted  group-[.toast]:text-muted-foreground",
          icon: "!mt-0.5",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
