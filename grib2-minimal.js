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
        const maxMessages = 200; // Safety limit
        let messageCount = 0;

        while (this.offset < this.data.byteLength - 4 && messageCount < maxMessages) {
            // Look for "GRIB" magic number (peek without advancing offset)
            const bytes = new Uint8Array(this.data.buffer, this.offset, 4);
            const magic = String.fromCharCode.apply(null, bytes);

            if (magic === 'GRIB') {
                this.offset += 4; // Now advance past "GRIB"
                try {
                    const message = this.parseMessage();
                    if (message) {
                        this.messages.push(message);
                        messageCount++;
                    }
                } catch (e) {
                    console.warn('Failed to parse GRIB message at offset', this.offset - 4, ':', e);
                    // Try to find next GRIB message
                }
            } else {
                this.offset++;
            }
        }

        console.log('Parsed', this.messages.length, 'GRIB messages');
    }

    parseMessage() {
        const startOffset = this.offset - 4;

        // Section 0: Indicator Section (already read "GRIB")
        // Bytes 5-6: Reserved
        this.offset += 2;
        // Byte 7: Discipline
        const discipline = this.getUint8(this.offset);
        this.offset += 1;
        // Byte 8: Edition (should be 2)
        const edition = this.getUint8(this.offset);
        this.offset += 1;
        // Bytes 9-16: Total length (8 bytes, but we'll read last 4 as most files are < 4GB)
        this.offset += 4; // Skip high 32 bits
        const totalLength = this.getUint32(this.offset);
        this.offset += 4;

        console.log('GRIB message found: discipline:', discipline, 'edition:', edition, 'length:', totalLength);

        const messageEnd = startOffset + totalLength;

        // Parse sections until we hit end
        let gridDef = null;
        let productDef = null;
        let dataDef = null;
        let dataSection = null;

        while (this.offset < messageEnd - 4) {
            const sectionLength = this.getUint32(this.offset);
            const sectionNumber = this.getUint8(this.offset + 4);

            if (sectionLength < 5 || this.offset + sectionLength > messageEnd) {
                console.warn('Invalid section length, skipping to next message');
                this.offset = messageEnd;
                return null;
            }

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
                this.offset += sectionLength;
                break;
            }

            this.offset += sectionLength;
        }

        // Make sure we're at the end of the message
        if (this.offset < messageEnd) {
            this.offset = messageEnd;
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

        // Parse Polar Stereographic projection (template 20)
        if (gridTemplateNum === 20) {
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
        // Parse Lambert Conformal projection (template 30)
        else if (gridTemplateNum === 30) {
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
        // Complex packing (template 3)
        else if (dataTemplate === 3) {
            const referenceValue = this.getFloat32(offset + 11);
            const binaryScaleFactor = this.getInt16(offset + 15);
            const decimalScaleFactor = this.getInt16(offset + 17);
            const bitsPerValue = this.getUint8(offset + 19);
            const groupSplittingMethod = this.getUint8(offset + 20);
            const missingValueManagement = this.getUint8(offset + 21);
            const primaryMissingValue = this.getUint32(offset + 22);
            const secondaryMissingValue = this.getUint32(offset + 26);
            const numberOfGroups = this.getUint32(offset + 30);
            const referenceForGroupWidths = this.getUint8(offset + 34);
            const bitsForGroupWidths = this.getUint8(offset + 35);
            const referenceForGroupLengths = this.getUint32(offset + 36);
            const lengthIncrementForGroupLengths = this.getUint8(offset + 40);
            const trueLengthOfLastGroup = this.getUint32(offset + 41);
            const bitsForScaledGroupLengths = this.getUint8(offset + 45);

            repr.referenceValue = referenceValue;
            repr.binaryScaleFactor = binaryScaleFactor;
            repr.decimalScaleFactor = decimalScaleFactor;
            repr.bitsPerValue = bitsPerValue;
            repr.groupSplittingMethod = groupSplittingMethod;
            repr.missingValueManagement = missingValueManagement;
            repr.primaryMissingValue = primaryMissingValue;
            repr.secondaryMissingValue = secondaryMissingValue;
            repr.numberOfGroups = numberOfGroups;
            repr.referenceForGroupWidths = referenceForGroupWidths;
            repr.bitsForGroupWidths = bitsForGroupWidths;
            repr.referenceForGroupLengths = referenceForGroupLengths;
            repr.lengthIncrementForGroupLengths = lengthIncrementForGroupLengths;
            repr.trueLengthOfLastGroup = trueLengthOfLastGroup;
            repr.bitsForScaledGroupLengths = bitsForScaledGroupLengths;
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

        // Complex packing (template 3)
        if (dataDef.template === 3) {
            console.log('Extracting complex packing data...');
            const data = new Float32Array(gridDef.numPoints);

            const ref = dataDef.referenceValue;
            const binScale = Math.pow(2, dataDef.binaryScaleFactor);
            const decScale = Math.pow(10, -dataDef.decimalScaleFactor);

            let bitOffset = dataSection.offset * 8;

            // Read group reference values
            const groupRefs = new Float32Array(dataDef.numberOfGroups);
            for (let i = 0; i < dataDef.numberOfGroups; i++) {
                const packedRef = this.readBits(bitOffset, dataDef.bitsPerValue);
                groupRefs[i] = ref + packedRef * binScale;
                bitOffset += dataDef.bitsPerValue;
            }

            // Read group widths
            const groupWidths = new Uint8Array(dataDef.numberOfGroups);
            for (let i = 0; i < dataDef.numberOfGroups; i++) {
                groupWidths[i] = this.readBits(bitOffset, dataDef.bitsForGroupWidths) + dataDef.referenceForGroupWidths;
                bitOffset += dataDef.bitsForGroupWidths;
            }

            // Read group lengths
            const groupLengths = new Uint32Array(dataDef.numberOfGroups);
            for (let i = 0; i < dataDef.numberOfGroups; i++) {
                const scaledLength = this.readBits(bitOffset, dataDef.bitsForScaledGroupLengths);
                groupLengths[i] = dataDef.referenceForGroupLengths + scaledLength * dataDef.lengthIncrementForGroupLengths;
                bitOffset += dataDef.bitsForScaledGroupLengths;
            }

            // Override last group length
            if (dataDef.numberOfGroups > 0) {
                groupLengths[dataDef.numberOfGroups - 1] = dataDef.trueLengthOfLastGroup;
            }

            // Unpack data values by group
            let dataIndex = 0;
            for (let g = 0; g < dataDef.numberOfGroups; g++) {
                const groupRef = groupRefs[g];
                const groupWidth = groupWidths[g];
                const groupLength = groupLengths[g];

                for (let i = 0; i < groupLength && dataIndex < gridDef.numPoints; i++) {
                    if (groupWidth === 0) {
                        data[dataIndex] = groupRef * decScale;
                    } else {
                        const packedValue = this.readBits(bitOffset, groupWidth);
                        data[dataIndex] = (groupRef + packedValue) * decScale;
                        bitOffset += groupWidth;
                    }
                    dataIndex++;
                }
            }

            console.log('Complex packing extracted', dataIndex, 'values');
            return data;
        }

        // For other templates, return zeros
        return new Float32Array(gridDef.numPoints);
    }

    readBits(bitOffset, numBits) {
        if (numBits === 0) return 0;
        if (numBits > 32) {
            console.error('Cannot read more than 32 bits at once');
            return 0;
        }

        let value = 0;
        let bitsRemaining = numBits;
        let currentBitOffset = bitOffset;

        while (bitsRemaining > 0) {
            const byteOffset = Math.floor(currentBitOffset / 8);
            const bitInByte = currentBitOffset % 8;
            const bitsAvailableInByte = 8 - bitInByte;
            const bitsToRead = Math.min(bitsRemaining, bitsAvailableInByte);

            if (byteOffset >= this.data.byteLength) {
                console.error('Bit offset exceeds data length');
                return value;
            }

            const byte = this.getUint8(byteOffset);
            const shift = bitsAvailableInByte - bitsToRead;
            const mask = ((1 << bitsToRead) - 1);
            const bits = (byte >> shift) & mask;

            value = (value << bitsToRead) | bits;
            bitsRemaining -= bitsToRead;
            currentBitOffset += bitsToRead;
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
