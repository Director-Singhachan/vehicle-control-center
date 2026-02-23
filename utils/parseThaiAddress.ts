/**
 * Parse Thai address text to extract sub-district (ตำบล) and district (อำเภอ)
 * Supports:
 *   - Abbreviated: ต.บ้านค่าย อ.บ้านค่าย
 *   - Full: ตำบลบ้านค่าย อำเภอบ้านค่าย
 *   - Bangkok: แขวงลาดยาว เขตจตุจักร
 */

export interface ParsedAddress {
    subDistrict: string | null;  // ตำบล / แขวง
    district: string | null;     // อำเภอ / เขต
    province: string | null;     // จังหวัด
}

/**
 * Parse a Thai address string and extract location parts.
 * Returns null values for parts that cannot be identified.
 */
export function parseThaiAddress(address: string | null | undefined): ParsedAddress {
    const result: ParsedAddress = {
        subDistrict: null,
        district: null,
        province: null,
    };

    if (!address) return result;

    const addr = address.trim();

    // --- ตำบล / แขวง ---
    // ต.XXX or ตำบลXXX or แขวงXXX
    const subDistrictMatch = addr.match(
        /(?:ต\.|ตำบล|แขวง)\s*([^\s,]+(?:\s+[^\s,อ.ตำบลแขวงเขตจ.จังหวัด]+)*)/
    );
    if (subDistrictMatch) {
        result.subDistrict = subDistrictMatch[1].trim();
    }

    // --- อำเภอ / เขต ---
    // อ.XXX or อำเภอXXX or เขตXXX
    const districtMatch = addr.match(
        /(?:อ\.|อำเภอ|เขต)\s*([^\s,]+(?:\s+[^\s,ต.ตำบลแขวงจ.จังหวัด]+)*)/
    );
    if (districtMatch) {
        result.district = districtMatch[1].trim();
    }

    // --- จังหวัด ---
    // จ.XXX or จังหวัดXXX or กรุงเทพมหานคร or กรุงเทพฯ
    const provinceMatch = addr.match(
        /(?:จ\.|จังหวัด)\s*([^\s,\d]+(?:\s+[^\s,\d]+)*)/
    );
    if (provinceMatch) {
        result.province = provinceMatch[1].trim();
    } else if (addr.includes('กรุงเทพ')) {
        result.province = 'กรุงเทพมหานคร';
    }

    return result;
}

/**
 * Build a group key from address for grouping orders by area.
 * Format: "อ.XXX / ต.YYY" or fallback labels.
 */
export function getAreaGroupKey(address: string | null | undefined): string {
    const parsed = parseThaiAddress(address);

    if (parsed.district && parsed.subDistrict) {
        return `อ.${parsed.district} / ต.${parsed.subDistrict}`;
    }
    if (parsed.district) {
        return `อ.${parsed.district}`;
    }
    if (parsed.subDistrict) {
        return `ต.${parsed.subDistrict}`;
    }

    return 'ไม่ระบุพื้นที่';
}

/**
 * Get only the district key for broader grouping.
 */
export function getDistrictKey(address: string | null | undefined): string {
    const parsed = parseThaiAddress(address);
    if (parsed.district) {
        return `อ.${parsed.district}`;
    }
    return 'ไม่ระบุอำเภอ';
}
