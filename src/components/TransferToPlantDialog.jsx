import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";

const GRADES = ["М150", "М200", "М300", "М400"];

export default function TransferToPlantDialog({
  order,
  open,
  onOpenChange,
  onTransferred,
}) {
  const [grade, setGrade] = useState("М200");
  const [cubes, setCubes] = useState("");
  const [address, setAddress] = useState("");
  const [mixerTime, setMixerTime] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (order) {
      setGrade(order.grade || "М200");
      setCubes(order.cubes != null ? String(order.cubes) : "");
      setAddress(order.delivery_address || "");
      setMixerTime(order.mixer_time || "");
    }
  }, [order]);

  const handleSubmit = async () => {
    if (!cubes || !address.trim() || !mixerTime.trim()) return;
    setLoading(true);
    try {
      await base44.entities.Order.update(order.id, {
        grade,
        cubes: parseFloat(cubes),
        delivery_address: address.trim(),
        mixer_time: mixerTime.trim(),
        status: "sent_to_plant",
      });
      onTransferred?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Передать заказ на завод</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Марка бетона</Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Объём (кубы)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={cubes}
              onChange={(e) => setCubes(e.target.value)}
              placeholder="Напр.: 7.5"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Адрес доставки</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Напр.: ул. Абая 150, Алматы"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Время подачи миксера</Label>
            <Input
              type="datetime-local"
              value={mixerTime}
              onChange={(e) => setMixerTime(e.target.value)}
              className="h-11"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !cubes || !address.trim() || !mixerTime.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Передать на завод
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
