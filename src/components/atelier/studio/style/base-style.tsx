"use client";

import { GARMENT_OPTIONS, type Garment, type SuitSpec } from "@convex/shared/atelier/spec";
import { garmentIncludes } from "./detail-groups";
import { OptionList, OptionRow } from "./option-list";

/**
 * S06, the three base styles. Choosing one commits straight away; when the engine has to move other
 * details (a tuxedo's pockets, a three-piece's waistcoat) the core asks first, and "Keep my design"
 * leaves the committed style selected.
 */
export function BaseStyle({
  spec,
  disabled,
  onChoose,
}: {
  spec: SuitSpec;
  disabled: boolean;
  onChoose: (garment: Garment) => void;
}) {
  return (
    <OptionList
      aria-labelledby="style-base-title"
      value={spec.garment}
      disabled={disabled}
      onValueChange={(value) => {
        const option = GARMENT_OPTIONS.find((entry) => entry.code === value);
        if (option && option.code !== spec.garment) onChoose(option.code);
      }}
    >
      {GARMENT_OPTIONS.map((option) => (
        <OptionRow
          key={option.code}
          id={`base-style-${option.code}`}
          value={option.code}
          title={option.label}
          code={option.productionId}
          description={
            <>
              {option.description}
              {garmentIncludes(option.code).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </>
          }
        />
      ))}
    </OptionList>
  );
}
