import { useI18n, LANGUAGES, detectLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Languages, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher({ full = false }: { full?: boolean }) {
  const { lang, setLang, translating } = useI18n();
  const current = LANGUAGES.find((l) => l.code === lang);
  const auto = detectLang();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="shrink-0 gap-1" aria-label="اللغة" data-no-translate>
          {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
          <span className={full ? "" : "hidden sm:inline"}>{current?.native ?? lang.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto" data-no-translate>
        <DropdownMenuLabel>Language / اللغة</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)} className="flex items-center justify-between">
            <span>
              {l.native}
              {l.code === auto ? <span className="ms-1 text-[10px] text-muted-foreground">(auto)</span> : null}
            </span>
            {l.code === lang ? <Check className="h-4 w-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
