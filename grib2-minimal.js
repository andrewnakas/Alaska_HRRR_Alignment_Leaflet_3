// Minimal GRIB2 parser for extracting composite reflectivity data
// Based on GRIB2 format specification

class MinimalGRIB2 {
    constructor(arrayBuffer) {
        this.data = new DataView(arrayBuffer);
        this.offset = 0;
        this.messages = [];
        this.parse();
    }

    parse() {
        while (this.offset < this.data.byteLength - 4) {
            // Look for "GRIB" magic number
            if (this.getString(4) === 'GRIB') {
                try {
                    const message = this.parseMessage();
                    if (message) {
                        this.messages.push(message);
                    }
                } catch (e) {
                    console.warn('Failed to parse GRIB message:', e);
                    // Try to find next GRIB message
                    this.offset++;
                }
            } else {
                this.offset++;
            }
        }
    }

    parseMessage() {
        const startOffset = this.offset - 4;

        // Section 0: Indicator Section
        this.offset += 2; // Skip discipline and edition
        const totalLength = this.getUint32(this.offset);
        this.offset += 4;

        const messageEnd = startOffset + totalLength;

        // Parse sections until we hit end
        let gridDef = null;
        let productDef = null;
        let dataDef = null;
        let dataSection = null;

        while (this.offset < messageEnd - 4) {
            const sectionLength = this.getUint32(this.offset);
            const sectionNumber = this.getUint8(this.offset + 4);

            if (sectionNumber === 3) {
                // Grid Definition Section
                gridDef = this.parseGridDefinition(this.offset, sectionLength);
            } else if (sectionNumber === 4) {
                // Product Definition Section
                productDef = this.parseProductDefinition(this.offset, sectionLength);
            } else if (sectionNumber === 5) {
                // Data Representation Section
                dataDef = this.parseDataRepresentation(this.offset, sectionLength);
            } else if (sectionNumber === 7) {
                // Data Section
                dataSection = { offset: this.offset + 5, length: sectionLength - 5 };
            } else if (sectionNumber === 8) {
                // End section
                break;
            }

            this.offset += sectionLength;
        }

        if (!gridDef || !productDef) {
            return null;
        }

        return {
            grid: gridDef,
            product: productDef,
            dataRepresentation: dataDef,
            dataSection: dataSection,
            getData: () => this.extractData(gridDef, dataDef, dataSection)
        };
    }

    parseGridDefinition(offset, length) {
        const sourceOfGridDef = this.getUint8(offset + 5);
        const numDataPoints = this.getUint32(offset + 6);
        const gridTemplateNum = this.getUint16(offset + 12);

        let grid = {
            source: sourceOfGridDef,
            numPoints: numDataPoints,
            template: gridTemplateNum
        };

        // Parse Lambert Conformal projection (template 30)
        if (gridTemplateNum === 30) {
            const nx = this.getUint32(offset + 30);
            const ny = this.getUint32(offset + 34);
            const la1 = this.getInt32(offset + 38) / 1000000;
            const lo1 = this.getInt32(offset + 42) / 1000000;
            const lad = this.getInt32(offset + 51) / 1000000;
            const lov = this.getInt32(offset + 55) / 1000000;

            grid.nx = nx;
            grid.ny = ny;
            grid.la1 = la1;
            grid.lo1 = lo1;
            grid.lad = lad;
            grid.lov = lov;
        }

        return grid;
    }

    parseProductDefinition(offset, length) {
        const templateNum = this.getUint16(offset + 7);
        const parameterCategory = this.getUint8(offset + 9);
        const parameterNumber = this.getUint8(offset + 10);

        return {
            template: templateNum,
            category: parameterCategory,
            parameter: parameterNumber
        };
    }

    parseDataRepresentation(offset, length) {
        const numDataPoints = this.getUint32(offset + 5);
        const dataTemplate = this.getUint16(offset + 9);

        let repr = {
            numPoints: numDataPoints,
            template: dataTemplate
        };

        // Simple packing (template 0)
        if (dataTemplate === 0) {
            const referenceValue = this.getFloat32(offset + 11);
            const binaryScaleFactor = this.getInt16(offset + 15);
            const decimalScaleFactor = this.getInt16(offset + 17);
            const bitsPerValue = this.getUint8(offset + 19);

            repr.referenceValue = referenceValue;
            repr.binaryScaleFactor = binaryScaleFactor;
            repr.decimalScaleFactor = decimalScaleFactor;
            repr.bitsPerValue = bitsPerValue;
        }

        return repr;
    }

    extractData(gridDef, dataDef, dataSection) {
        if (!dataSection || !dataDef) {
            return new Float32Array(gridDef.numPoints);
        }

        // Simple unpacking for template 0
        if (dataDef.template === 0) {
            const data = new Float32Array(gridDef.numPoints);
            const bits = dataDef.bitsPerValue;
            const ref = dataDef.referenceValue;
            const binScale = Math.pow(2, dataDef.binaryScaleFactor);
            const decScale = Math.pow(10, -dataDef.decimalScaleFactor);

            // Read packed integers
            let bitOffset = dataSection.offset * 8;
            for (let i = 0; i < gridDef.numPoints; i++) {
                const packedValue = this.readBits(bitOffset, bits);
                data[i] = (ref + packedValue * binScale) * decScale;
                bitOffset += bits;
            }

            return data;
        }

        // For other templates, return zeros for now
        return new Float32Array(gridDef.numPoints);
    }

    readBits(bitOffset, numBits) {
        const byteOffset = Math.floor(bitOffset / 8);
        const bitInByte = bitOffset % 8;

        let value = 0;
        let bitsRead = 0;

        while (bitsRead < numBits) {
            const bitsAvailable = 8 - bitInByte - bitsRead;
            const bitsToRead = Math.min(numBits - bitsRead, bitsAvailable);
            const shift = bitsAvailable - bitsToRead;
            const mask = ((1 << bitsToRead) - 1) << shift;

            const byte = this.getUint8(byteOffset + Math.floor(bitsRead / 8));
            const bits = (byte & mask) >> shift;

            value = (value << bitsToRead) | bits;
            bitsRead += bitsToRead;
        }

        return value;
    }

    getString(length) {
        const bytes = new Uint8Array(this.data.buffer, this.offset, length);
        this.offset += length;
        return String.fromCharCode.apply(null, bytes);
    }

    getUint8(offset) {
        return this.data.getUint8(offset);
    }

    getUint16(offset) {
        return this.data.getUint16(offset, false); // big-endian
    }

    getUint32(offset) {
        return this.data.getUint32(offset, false);
    }

    getInt16(offset) {
        return this.data.getInt16(offset, false);
    }

    getInt32(offset) {
        return this.data.getInt32(offset, false);
    }

    getFloat32(offset) {
        return this.data.getFloat32(offset, false);
    }
}

// Export for use in app.js
window.MinimalGRIB2 = MinimalGRIB2;
