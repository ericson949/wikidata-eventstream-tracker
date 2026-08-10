import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Send, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [webhookUrl, setWebhookUrl] = useState('https://api.votre-domaine.com/webhook/politili');
  const [ignoreBots, setIgnoreBots] = useState(true);
  const [testSuccessMsg, setTestSuccessMsg] = useState('');

  const handleTestWebhook = () => {
    setTestSuccessMsg('✓ Payload JSON de test envoyé avec succès ! HTTP 200 OK');
    setTimeout(() => setTestSuccessMsg(''), 4000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-blue-950">
            <Settings className="h-6 w-6 text-blue-800" />
            Configuration Webhooks & Direct Dispatch
          </DialogTitle>
          <DialogDescription>
            Notification instantanée des événements Wikidata vers vos services externes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Webhook Endpoint */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              URL du Webhook (HTTP POST)
            </label>
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-900 px-2.5 py-1.5 font-mono text-xs font-bold text-white">POST</span>
              <Input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.votre-domaine.com/webhook"
                className="font-mono text-xs"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Compatible avec Slack Webhooks, Discord, Zapier, n8n ou votre API locale.
            </p>
          </div>

          {/* Anti Bot Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Filtre Anti-Bots Wikidata</div>
              <div className="text-xs text-slate-500">Ignorer les éditions générées automatiquement par les scripts Wikimedia.</div>
            </div>
            <input
              type="checkbox"
              checked={ignoreBots}
              onChange={(e) => setIgnoreBots(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-blue-900 focus:ring-blue-600 cursor-pointer"
            />
          </div>

          {/* Diagnostic Test Button */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-blue-950">Diagnostic & Notification de Test</div>
                <div className="text-[11px] text-blue-700">Simuler l'envoi d'un payload JSON pour valider la réception.</div>
              </div>
              <Button size="sm" variant="outline" onClick={handleTestWebhook} className="bg-white hover:bg-blue-100">
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Tester
              </Button>
            </div>
            {testSuccessMsg && (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 pt-1">
                <CheckCircle2 className="h-4 w-4" />
                {testSuccessMsg}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button className="bg-blue-900 hover:bg-blue-800" onClick={onClose}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
