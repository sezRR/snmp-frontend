import { useSidebar } from "@/components/ui/sidebar"

export function useCloseOnNavigate(): () => void {
  const { isMobile, setOpenMobile } = useSidebar()
  return () => {
    if (isMobile) setOpenMobile(false)
  }
}
