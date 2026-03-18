import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Feil",
        description: "Passordene stemmer ikke overens",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Feil",
        description: "Passordet må være minst 6 tegn",
      });
      return;
    }

    register.mutate(
      { email, password },
      {
        onSuccess: () => {
          toast({
            title: "Konto opprettet",
            description: "Du er nå registrert og logget inn",
          });
          navigate("/profile");
        },
        onError: (error: Error) => {
          toast({
            variant: "destructive",
            title: "Registrering feilet",
            description: error.message.includes("409")
              ? "E-postadressen er allerede registrert"
              : "Noe gikk galt. Prøv igjen.",
          });
        },
      },
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">Registrer deg</CardTitle>
          <CardDescription>
            Opprett en konto for å komme i gang
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                placeholder="din@epost.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passord</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minst 6 tegn"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bekreft passord</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Gjenta passordet"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={register.isPending}>
              {register.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrer deg
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Har du allerede en konto?{" "}
            <a
              href="#/login"
              className="text-primary hover:underline font-medium"
            >
              Logg inn
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
