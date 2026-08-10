import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * رصيد النقاط الحالي — يتحدث فوراً بعد موافقة الإدارة على طلب الشحن
 * (اشتراك لحظي على صف الملف الشخصي + تحديث دوري كخطة بديلة).
 */
export function useCredits(userId?: string | null, enabled = true) {
  const qc = useQueryClient();
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const query = useQuery({
    enabled: !!userId && enabled,
    queryKey: ["credits", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", userId ?? "")
        .single();
      if (error) throw error;
      if (typeof data?.credits !== "number") throw new Error("تعذّر قراءة رصيد النقاط");
      return data.credits;
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`credits-live-${userId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload: any) => {
          const next = payload?.new?.credits;
          if (typeof next === "number") qc.setQueryData(["credits", userId], next);
          qc.invalidateQueries({ queryKey: ["credits", userId] });
          qc.invalidateQueries({ queryKey: ["my-recharges"] });
          qc.invalidateQueries({ queryKey: ["profile"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc, instanceId]);

  return query;
}
