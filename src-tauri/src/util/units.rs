//! ISS-071 m2: PDF 单位转换工具（Rust 侧）。
//!
//! pt / cm / mm / in 互转。TypeScript 等价：`src/shared/units.ts convertLength()`。
//! 参考 PDF-Guru `thirdparty/utils.py:88-99 convert_length()`，独立 Rust 实现。
//!
//! 标准换算：1 inch = 72 pt = 2.54 cm = 25.4 mm。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Unit {
    Pt,
    Cm,
    Mm,
    In,
}

impl Unit {
    /// 1 unit 转换成 pt 的系数
    fn to_point(self) -> f64 {
        match self {
            Unit::Pt => 1.0,
            Unit::In => 72.0,
            Unit::Cm => 72.0 / 2.54,
            Unit::Mm => 72.0 / 25.4,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum UnitsError {
    NonFiniteValue(f64),
}

impl std::fmt::Display for UnitsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UnitsError::NonFiniteValue(v) => write!(
                f,
                "Invalid length: value must be a finite number, got {}",
                v
            ),
        }
    }
}

impl std::error::Error for UnitsError {}

pub fn convert_length(value: f64, from: Unit, to: Unit) -> Result<f64, UnitsError> {
    if !value.is_finite() {
        return Err(UnitsError::NonFiniteValue(value));
    }
    if from == to {
        return Ok(value);
    }
    let value_in_pt = value * from.to_point();
    Ok(value_in_pt / to.to_point())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_close(a: f64, b: f64, tolerance: f64) {
        assert!(
            (a - b).abs() < tolerance,
            "expected {} ~ {}, abs diff {}",
            a,
            b,
            (a - b).abs()
        );
    }

    #[test]
    fn same_unit_returns_input() {
        assert_eq!(convert_length(72.0, Unit::Pt, Unit::Pt).unwrap(), 72.0);
        assert_eq!(convert_length(2.54, Unit::Cm, Unit::Cm).unwrap(), 2.54);
    }

    #[test]
    fn pt_to_in_and_back() {
        assert_close(convert_length(72.0, Unit::Pt, Unit::In).unwrap(), 1.0, 1e-6);
        assert_close(convert_length(1.0, Unit::In, Unit::Pt).unwrap(), 72.0, 1e-6);
        assert_close(convert_length(144.0, Unit::Pt, Unit::In).unwrap(), 2.0, 1e-6);
    }

    #[test]
    fn in_to_cm_and_back() {
        assert_close(convert_length(1.0, Unit::In, Unit::Cm).unwrap(), 2.54, 1e-6);
        assert_close(convert_length(2.54, Unit::Cm, Unit::In).unwrap(), 1.0, 1e-6);
    }

    #[test]
    fn in_to_mm_and_back() {
        assert_close(convert_length(1.0, Unit::In, Unit::Mm).unwrap(), 25.4, 1e-6);
        assert_close(convert_length(25.4, Unit::Mm, Unit::In).unwrap(), 1.0, 1e-6);
    }

    #[test]
    fn cm_to_mm_and_back() {
        assert_close(convert_length(1.0, Unit::Cm, Unit::Mm).unwrap(), 10.0, 1e-6);
        assert_close(convert_length(10.0, Unit::Mm, Unit::Cm).unwrap(), 1.0, 1e-6);
    }

    #[test]
    fn zero_and_negative() {
        assert_eq!(convert_length(0.0, Unit::Pt, Unit::Cm).unwrap(), 0.0);
        assert_close(convert_length(-72.0, Unit::Pt, Unit::In).unwrap(), -1.0, 1e-6);
    }

    #[test]
    fn nan_and_infinity_rejected() {
        assert!(matches!(
            convert_length(f64::NAN, Unit::Pt, Unit::Cm),
            Err(UnitsError::NonFiniteValue(_))
        ));
        assert!(matches!(
            convert_length(f64::INFINITY, Unit::Pt, Unit::Cm),
            Err(UnitsError::NonFiniteValue(_))
        ));
    }

    #[test]
    fn full_matrix_one_inch() {
        // 1 inch 在 4 个单位下的等价值
        let one_inch_in = [
            (Unit::Pt, 72.0),
            (Unit::Cm, 2.54),
            (Unit::Mm, 25.4),
            (Unit::In, 1.0),
        ];
        for &(from, from_val) in &one_inch_in {
            for &(to, to_val) in &one_inch_in {
                let result = convert_length(from_val, from, to).unwrap();
                assert_close(result, to_val, 1e-4);
            }
        }
    }

    #[test]
    fn serde_serializes_to_lowercase() {
        let pt = serde_json::to_string(&Unit::Pt).unwrap();
        assert_eq!(pt, "\"pt\"");
        let cm = serde_json::to_string(&Unit::Cm).unwrap();
        assert_eq!(cm, "\"cm\"");
    }
}
