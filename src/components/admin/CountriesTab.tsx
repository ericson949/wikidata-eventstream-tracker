import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Globe } from 'lucide-react';
import { Country } from '@/types';

interface CountriesTabProps {
  countries: Country[];
}

export default function CountriesTab({ countries }: CountriesTabProps) {
  const totalCount = countries.length;
  const westCount = countries.filter(c => (c.region || '').includes('Ouest')).length;
  const centralCount = countries.filter(c => (c.region || '').includes('Centrale')).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-extrabold text-blue-950">{totalCount}</div>
                <div className="mt-1 text-xs font-medium text-slate-500">Pays Référencés en BDD</div>
              </div>
              <Globe className="h-8 w-8 text-blue-800 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-5">
            <div className="text-3xl font-extrabold text-emerald-600">{westCount}</div>
            <div className="mt-1 text-xs font-medium text-emerald-700">Afrique de l'Ouest</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-5">
            <div className="text-3xl font-extrabold text-blue-600">{centralCount}</div>
            <div className="mt-1 text-xs font-medium text-blue-700">Afrique Centrale</div>
          </CardContent>
        </Card>
      </div>

      {/* Countries Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Drapeau & Nom du Pays</TableHead>
            <TableHead>Identifiant Q-ID Wikidata</TableHead>
            <TableHead>Code ISO</TableHead>
            <TableHead>Région Géographique</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {countries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                Aucun pays répertorié.
              </TableCell>
            </TableRow>
          ) : (
            countries.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-3 font-semibold text-slate-900 text-base">
                    <span className="text-2xl">{c.flag || '🌍'}</span>
                    <span>{c.name}</span>
                  </div>
                </TableCell>

                <TableCell>
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-800">{c.id}</code>
                </TableCell>

                <TableCell>
                  <Badge variant="secondary" className="font-mono">
                    {c.code || 'AF'}
                  </Badge>
                </TableCell>

                <TableCell className="text-slate-600 font-medium text-sm">
                  {c.region || 'Afrique'}
                </TableCell>

                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://www.wikidata.org/wiki/${c.id}`, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Voir sur Wikidata
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
