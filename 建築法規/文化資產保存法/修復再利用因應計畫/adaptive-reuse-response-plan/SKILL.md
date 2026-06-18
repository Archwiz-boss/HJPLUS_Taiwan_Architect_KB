---
name: adaptive-reuse-response-plan
description: "This skill should be used when handling the restoration and adaptive reuse of cultural heritage buildings, specifically for creating a response plan to exempt them from standard urban planning, building, and fire codes."
license: CC-BY-SA-4.0
compatibility: claude-code,opencode,agent-skills
metadata:
  audience: architects
  region: taiwan
---

# Heritage Adaptive Reuse Response Plan (Taiwan)

## Overview
This skill provides guidelines on the legal exemptions available for cultural heritage buildings (Monuments, Historic Buildings, etc.) undergoing restoration or adaptive reuse. Under the Cultural Heritage Preservation Act, these buildings can be exempted from certain provisions of the Urban Planning Law, Building Act, and Fire Services Act by submitting an "Adaptive Reuse Response Plan" (因應計畫).

## Execution Steps
1. **Identify Exemptions Needed**: Assess which current building, fire, or land-use codes conflict with the preservation of the heritage building's original structure or historical value.
2. **Formulate the Response Plan**: Develop alternative safety and management strategies (the Response Plan) for the non-compliant items. This includes:
   - Alternative structural safety measures.
   - Fire safety compensatory measures (e.g., dedicated fire suppression systems suitable for historic materials).
   - Accessibility and land-use alternatives.
3. **Submit for Joint Review**: Submit the Response Plan to the competent cultural authority, which will coordinate a joint review with building control, fire safety, and urban planning departments.
4. **Implementation**: Once approved, the Response Plan legally supersedes the standard codes for that specific building.

## Technical Specifications (Exemptible Regulations)

### 1. Urban Planning Law (都市計畫法)
- Exemptions can often be made for land-use zoning restrictions, allowing commercial or educational use in areas normally restricted, provided it serves the purpose of heritage revitalization.

### 2. Building Act (建築法)
- **Clearance/Setbacks**: Exemptions from building line setbacks.
- **Structural Constraints**: Exemptions from modern seismic or structural requirements if they would destroy historic value (alternative structural reinforcement plans required).
- **Facilities**: Exemptions from parking spaces, air defense shelters, and certain accessibility requirements (though reasonable accommodation is expected).
- **Building Permit Process**: The restoration plan approval can serve in lieu of standard building permits in some cases.

### 3. Fire Services Act (消防法)
- Exemptions from standard fire equipment rules.
- Requires a specialized fire safety design tailored to historic buildings (e.g., water mist systems instead of standard sprinklers, early warning systems).

## Requirements & Constraints
- The exemptions are NOT automatic. They are strictly contingent upon the approval of the "Adaptive Reuse Response Plan" (因應計畫) which must prove that alternative measures provide equivalent or acceptable levels of safety.
- Reference: *Regulations for the Processing of Building Management, Land Use, and Fire Safety for the Restoration or Adaptive Reuse of Monuments, Historic Buildings, Commemorative Buildings, and Groups of Buildings* (古蹟歷史建築紀念建築及聚落建築群修復或再利用建築管理土地使用消防安全處理辦法).

## MCP Tool Integration Examples
```python
# Query building code exemptions for cultural heritage
taiwan-building-code_search_building_code(query="因應計畫 消防", limit=5)
taiwan-building-code_search_building_interpretations(query="古蹟 再利用")
```
