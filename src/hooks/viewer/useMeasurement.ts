/**
 * 测量工具 Hook
 * 管理测量线段的创建、删除和角距计算
 */

import { useState, useCallback, useMemo } from "react";
import type { AstrometryCalibration } from "../lib/astrometry/types";
import { pixelToRaDec } from "../lib/astrometry/wcsProjection";
import {
  angularSeparationVincenty,
  pixelDistance,
  formatAngularDistance,
} from "../lib/astrometry/measurementUtils";
import { formatRA, formatDec } from "../lib/astrometry/formatUtils";

export interface MeasurementPoint {
  x: number;
  y: number;
  ra?: string;
  dec?: string;
  raDeg?: number;
  decDeg?: number;
}

export interface MeasurementLine {
  id: string;
  p1: MeasurementPoint;
  p2: MeasurementPoint;
  pixelDist: number;
  angularDist?: number;
  angularDistLabel?: string;
}

export interface UseMeasurementReturn {
  measurements: MeasurementLine[];
  isActive: boolean;
  pendingPoint: MeasurementPoint | null;
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
  addPoint: (x: number, y: number) => void;
  removeLast: () => void;
  clear: () => void;
  measurementCount: number;
}

function resolvePoint(
  x: number,
  y: number,
  calibration: AstrometryCalibration | null | undefined,
): MeasurementPoint {
  const point: MeasurementPoint = { x, y };
  if (calibration) {
    const radec = pixelToRaDec(x, y, calibration);
    if (radec) {
      point.raDeg = radec.ra;
      point.decDeg = radec.dec;
      point.ra = formatRA(radec.ra);
      point.dec = formatDec(radec.dec);
    }
  }
  return point;
}

let measurementIdCounter = 0;

export function useMeasurement(calibration?: AstrometryCalibration | null): UseMeasurementReturn {
  const [isActive, setIsActive] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<MeasurementPoint | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementLine[]>([]);

  const activate = useCallback(() => setIsActive(true), []);
  const deactivate = useCallback(() => {
    setIsActive(false);
    setPendingPoint(null);
  }, []);
  const toggle = useCallback(() => {
    setIsActive((prev) => {
      if (prev) setPendingPoint(null);
      return !prev;
    });
  }, []);

  const addPoint = useCallback(
    (x: number, y: number) => {
      if (!isActive) return;

      const point = resolvePoint(x, y, calibration);

      if (!pendingPoint) {
        setPendingPoint(point);
        return;
      }

      // Create measurement line from pending + new point
      const pDist = pixelDistance(pendingPoint.x, pendingPoint.y, x, y);
      let angularDist: number | undefined;
      let angularDistLabel: string | undefined;

      if (
        pendingPoint.raDeg != null &&
        pendingPoint.decDeg != null &&
        point.raDeg != null &&
        point.decDeg != null
      ) {
        angularDist = angularSeparationVincenty(
          pendingPoint.raDeg,
          pendingPoint.decDeg,
          point.raDeg,
          point.decDeg,
        );
        angularDistLabel = formatAngularDistance(angularDist);
      }

      const line: MeasurementLine = {
        id: `m_${++measurementIdCounter}`,
        p1: pendingPoint,
        p2: point,
        pixelDist: pDist,
        angularDist,
        angularDistLabel,
      };

      setMeasurements((prev) => [...prev, line]);
      setPendingPoint(null);
    },
    [isActive, pendingPoint, calibration],
  );

  const removeLast = useCallback(() => {
    setMeasurements((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  const clear = useCallback(() => {
    setMeasurements([]);
    setPendingPoint(null);
  }, []);

  const measurementCount = useMemo(() => measurements.length, [measurements]);

  return {
    measurements,
    isActive,
    pendingPoint,
    activate,
    deactivate,
    toggle,
    addPoint,
    removeLast,
    clear,
    measurementCount,
  };
}
