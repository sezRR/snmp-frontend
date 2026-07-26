import { useSidebar } from "@/components/ui/sidebar"

/**
 * On mobile the sidebar is an overlay sheet: following a link inside it has to
 * dismiss it, otherwise the sheet stays over the page it just navigated to.
 * On desktop the sidebar is persistent and must stay put.
 */
export function useCloseOnNavigate(): () => void {
  const { isMobile, setOpenMobile } = useSidebar()
  return () => {
    if (isMobile) setOpenMobile(false)
  }
}
