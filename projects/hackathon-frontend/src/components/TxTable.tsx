"use client";
import * as React from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { TxRow } from "@/hooks/useAnalytics";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function truncateMiddle(str: string, max = 15) {
  if (!str) return "";
  if (str.length <= max) return str;
  // keep start portion, drop middle, keep last 4 for recognizability
  const head = str.slice(0, Math.max(0, max - 5)); // leaves room for “…XXXX”
  const tail = str.slice(-4);
  return `${head}…${tail}`;
}

function AddressCell({ value }: { value: string }) {
  const display = truncateMiddle(value, 15);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="font-mono text-xs cursor-help">{display}</span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="font-mono text-xs">{value}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const columns: ColumnDef<TxRow>[] = [
  { header: "When", accessorKey: "ts" },
  { header: "Status", accessorKey: "status" }, // Received / Sent
  {
    header: "Amount",
    accessorKey: "amountSigned",
    cell: ({ row }) => {
      const dir = row.original.direction;
      return <span className={dir === "IN" ? "text-emerald-600" : "text-red-600"}>{row.getValue("amountSigned")}</span>;
    },
  },
  {
    header: "From",
    accessorKey: "from",
    cell: ({ row }) => <AddressCell value={row.original.from} />,
  },
  {
    header: "To",
    accessorKey: "to",
    cell: ({ row }) => <AddressCell value={row.original.to} />,
  },
  { header: "Type", accessorKey: "noteType" },
  {
    header: "Tx",
    accessorKey: "txid",
    cell: ({ row }) => {
      const id = row.getValue("txid") as string;
      const display = truncateMiddle(id, 15);
      return (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="font-mono text-xs underline decoration-dotted cursor-help"
                title=""
              >
                {display}
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-mono text-xs">{id}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
];

export function TxTable({ data, loading }: { data: TxRow[]; loading?: boolean }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                Loading…
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((r) => (
              <TableRow key={r.id}>
                {r.getVisibleCells().map((c) => (
                  <TableCell key={c.id}>{flexRender(c.column.columnDef.cell ?? c.column.columnDef.header, c.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No transactions yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
