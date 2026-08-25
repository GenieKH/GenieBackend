const fs = require('fs');
const file = 'c:/Users/SengPooPoo/Desktop/genie-backend/user/src/properties/properties.service.ts';
let content = fs.readFileSync(file, 'utf8');
const oldText = 'async updateBoundary(userId: string, id: string, boundaryDto: BoundaryDto) {\r\n    await this.findOne(userId, id);\r\n    return this.prisma.property.update({\r\n      where: { id },\r\n      data: { boundaryPoints: boundaryDto.boundaryPoints },\r\n    });\r\n  }';
const oldTextLf = 'async updateBoundary(userId: string, id: string, boundaryDto: BoundaryDto) {\n    await this.findOne(userId, id);\n    return this.prisma.property.update({\n      where: { id },\n      data: { boundaryPoints: boundaryDto.boundaryPoints },\n    });\n  }';
const newText = `async updateBoundary(userId: string, id: string, boundaryDto: BoundaryDto) {\n    await this.findOne(userId, id);\n    let lat: number | undefined;\n    let lng: number | undefined;\n    \n    const points = boundaryDto.boundaryPoints;\n    if (Array.isArray(points) && points.length > 0) {\n      const sumLat = points.reduce((sum: number, p: any) => sum + (p.lat || 0), 0);\n      const sumLng = points.reduce((sum: number, p: any) => sum + (p.lng || 0), 0);\n      lat = sumLat / points.length;\n      lng = sumLng / points.length;\n    }\n\n    return this.prisma.property.update({\n      where: { id },\n      data: { \n        boundaryPoints: boundaryDto.boundaryPoints,\n        ...(lat !== undefined && { lat }),\n        ...(lng !== undefined && { lng }),\n      },\n    });\n  }`;
content = content.replace(oldText, newText).replace(oldTextLf, newText);
fs.writeFileSync(file, content);

