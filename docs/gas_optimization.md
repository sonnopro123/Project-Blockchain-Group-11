# Hướng dẫn Tối ưu hóa Gas ở Tầng Frontend (CredProof)

Tài liệu này giải thích chi tiết các phương pháp thiết kế và kỹ thuật tối ưu hóa phí gas (phí giao dịch blockchain) được thực hiện ở tầng **Frontend** của dự án **CredProof**. 

Bằng cách chuyển giao các tác vụ tính toán phức tạp và lưu trữ dữ liệu cồng kềnh từ Smart Contract (On-chain) sang ứng dụng Client-side (Off-chain), hệ thống đạt được hiệu suất cao nhất với chi phí vận hành tối thiểu.

---

## 1. Cơ chế Tái tạo danh sách bằng Event (Event Replay)

### Bài toán thông thường:
Để quản trị và hiển thị danh sách các trường đại học (Issuer) được Admin ủy quyền trên Dashboard, cách thông thường là khai báo một mảng động trong Solidity:
```solidity
address[] public issuerList; // Cách này cực kỳ tốn gas
```
Mỗi khi Admin gọi `addIssuer` hoặc `removeIssuer`, hợp đồng thông minh phải ghi dữ liệu vào mảng, tìm kiếm phần tử cần xóa, dịch chuyển các phần tử còn lại. Các thao tác ghi và cập nhật mảng động trên EVM tốn **hàng chục ngàn đến hàng trăm ngàn gas** (phép toán `SSTORE` ghi dữ liệu lên ổ đĩa của node).

### Giải pháp tối ưu ở Frontend:
Smart Contract chỉ lưu trữ trạng thái dưới dạng `mapping(address => bool)` đơn giản và phát ra các sự kiện:
```solidity
event IssuerAdded(address indexed issuer);
event IssuerRemoved(address indexed issuer);
```
Tại [frontend/src/services/contract.js](../frontend/src/services/contract.js#L55-L82), danh sách Issuer được dựng lại hoàn toàn off-chain bằng cách:
1. Truy vấn tất cả các event logs của `IssuerAdded` và `IssuerRemoved` thông qua RPC node:
   ```javascript
   const [added, removed] = await Promise.all([
     contract.queryFilter(contract.filters.IssuerAdded()),
     contract.queryFilter(contract.filters.IssuerRemoved()),
   ])
   ```
2. Gộp chung các sự kiện, sắp xếp theo thời gian (`blockNumber` và `logIndex`).
3. Duyệt tuần tự để dựng lại trạng thái danh sách các ví Issuer đang hoạt động (Replay).

**Hiệu quả:** Việc phát sự kiện (lệnh `LOG` trong EVM) rẻ hơn từ **5 đến 10 lần** so với việc ghi lưu trữ trạng thái. Frontend xử lý tính toán danh sách trên trình duyệt của Admin mà không tiêu tốn bất kỳ một lượng gas nào của hệ thống.

---

## 2. Gom nhóm thông tin bảng điểm qua Cây Merkle (Merkle Tree Root)

### Bài toán thông thường:
Lưu trữ toàn bộ thông tin học tập của sinh viên (họ tên, mã sinh viên, danh sách 20-30 môn học kèm điểm số tương ứng) trực tiếp lên blockchain. Việc lưu trữ chuỗi văn bản (String) và mảng cấu trúc (Array of Structs) trên EVM sẽ tốn hàng triệu gas, tương đương vài chục đến vài trăm USD cho mỗi tấm bằng được cấp phát.

### Giải pháp tối ưu ở Frontend:
Frontend gánh toàn bộ việc tính toán cấu trúc cây Merkle bằng JavaScript off-chain trước khi gửi yêu cầu ký:
1. Mỗi môn học được băm thành một Node lá (Leaf Hash):
   $$\text{leaf} = \text{keccak256}(\text{courseCode} + \text{"|"} + \text{grade})$$
2. Sử dụng thư viện `merkletreejs` để dựng cây Merkle từ các lá đó (sắp xếp cặp `sortPairs: true`) để tính ra mã băm gốc duy nhất **`merkleRoot`** (dài 32 bytes).
3. Ghép `merkleRoot` cùng các trường siêu dữ liệu hành chính khác để tính ra mã băm văn bằng **`credentialHash`**.
4. Issuer chỉ cần gọi hàm `issueCredential(bytes32 credentialHash)` on-chain.

**Hiệu quả:** Bất kể bảng điểm của sinh viên có bao nhiêu môn học (5 môn hay 100 môn), lượng dữ liệu thực tế ghi lên blockchain chỉ luôn là **1 mã băm dài 32 bytes**. Chi phí gas cho mỗi lần đăng ký văn bằng là cố định, cực kỳ nhỏ và không bị tăng theo kích thước bảng điểm.

---

## 3. Ký số EIP-191 Personal Sign (0 Gas)

### Bài toán thông thường:
Xác thực danh tính nhà phát hành bằng cách yêu cầu ví của trường đại học gửi giao dịch và thực hiện các bước kiểm tra logic trên Smart Contract.

### Giải pháp tối ưu ở Frontend:
Sử dụng chữ ký số off-chain thông qua MetaMask. 
1. Sau khi frontend tính toán xong `credentialHash`, thay vì gửi trực tiếp lên blockchain, ứng dụng gọi MetaMask yêu cầu trường học ký số theo chuẩn **EIP-191 personal sign**:
   ```javascript
   export async function signCredential(signer, credentialHash) {
     return signer.signMessage(ethers.getBytes(credentialHash))
   }
   ```
2. MetaMask sẽ mã hóa thông điệp cục bộ trên máy tính bằng khóa bí mật của trường và trả về chữ ký số **`issuerSignature`**.

**Hiệu quả:** Thao tác ký số này hoàn toàn miễn phí (**0 gas**). Trường đại học có thể ký phát hành hàng triệu văn bằng mà không cần sở hữu bất kỳ đồng ETH nào trong ví để trả phí giao dịch. Phí gas chỉ phát sinh một lần duy nhất khi trường gọi hàm `issueCredential` để kích hoạt mã băm văn bằng đó trên Blockchain.

---

## 4. Thiết lập giới hạn Gas cứng (`gasLimit`)

Khi gọi các giao dịch tương tác ghi dữ liệu lên Smart Contract (đăng ký bằng cấp hoặc thu hồi bằng cấp), frontend không dựa hoàn toàn vào cơ chế tự động ước lượng gas (`estimateGas`) mặc định của ví mà chỉ định cứng một giới hạn gas an toàn trong [frontend/src/services/contract.js](../frontend/src/services/contract.js#L27-L34):

```javascript
export async function issueCredential(signer, credentialHash) {
  // Đặt gasLimit cố định để tăng tốc độ hiển thị MetaMask popup
  const tx = await getContract(signer).issueCredential(credentialHash, { gasLimit: 150000 })
  return tx.wait()
}
```

**Hiệu quả:** 
* Giảm bớt 1 yêu cầu mạng JSON-RPC gửi tới blockchain node để ước lượng gas (`eth_estimateGas`), giúp popup MetaMask hiển thị nhanh hơn đáng kể.
* Tránh tình trạng giao dịch bị thất bại do ví ước lượng thiếu gas trong các thời điểm mạng lưới bị nghẽn (gây lãng phí gas của người dùng).
