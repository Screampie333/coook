/** Memendekkan alamat wallet/contract: "AbCd…WxYz". */
export function shortenAddress(address: string, chars = 4) {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
