const slpMdm = require('slp-mdm')
const BigNumber = require('bignumber.js')


const pushdata = (buf) => {
  if (buf.length === 0) {
    return Buffer.from([0x4C, 0x00]);
  } else if (buf.length < 0x4E) {
    return Buffer.concat([Buffer.from([buf.length]), buf]);
  } else if (buf.length < 0xFF) {
    return Buffer.concat([Buffer.from([0x4c, buf.length]), buf]);
  } else if (buf.length < 0xFFFF) {
    const tmp = Buffer.allocUnsafe(2);
    tmp.writeUInt16LE(buf.length, 0);
    return Buffer.concat([Buffer.from([0x4d]), tmp, buf]);
  } else if (buf.length < 0xFFFFFFFF) {
    const tmp = Buffer.allocUnsafe(4);
    tmp.writeUInt32LE(buf.length, 0);
    return Buffer.concat([Buffer.from([0x4e]), tmp, buf]);
  } else {
    throw new Error('does not support bigger pushes yet');
  }
};


class OpReturnGenerator {

  constructor () {}

  generateDataOpReturn(data) {
    try {
      
      const buf = Buffer.concat([
        Buffer.from([0x6A]), // OP_RETURN
        pushdata(Buffer.from(data)) // data
      ])
      
      return buf

    } catch(err) {
      throw err
    }
  }
}

module.exports = OpReturnGenerator
