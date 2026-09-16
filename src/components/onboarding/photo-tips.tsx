import { Lightbulb, PersonStanding, Shirt, Square, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TIPS = [
  { icon: Square, title: "Plain background", body: "A blank wall keeps the focus on you." },
  { icon: Shirt, title: "Neutral clothes", body: "Fitted, simple layers so garments sit naturally." },
  { icon: Sun, title: "Even light", body: "Face a window. No harsh shadows or direct flash." },
  { icon: PersonStanding, title: "Head to hip", body: "Stand square to the camera, arms relaxed at your sides." },
] as const;

/** What makes a photo render well. Shown next to the avatar uploader during onboarding. */
export function PhotoTips() {
  return (
    <Card className="bg-muted/30 dark:bg-muted/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb className="text-credit size-4" aria-hidden />
          What makes a good photo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {TIPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="space-y-0.5">
                <p className="text-sm leading-none font-medium">{title}</p>
                <p className="text-muted-foreground text-sm">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
