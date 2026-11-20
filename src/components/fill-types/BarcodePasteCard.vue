<template>
  <div class="barcode-paste-card">
    <div class="barcode-paste-box">
      <div class="barcode-paste-title">条码粘贴区</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BarcodePasteCard'
};
</script>

<style scoped>
.barcode-paste-card {
  width: 250px;
  flex-shrink: 0;
  border: 1px solid #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.barcode-paste-title {
  font-size: 20px;
  color: #4c4c4c;
  line-height: 1;
  white-space: nowrap;
}

.barcode-paste-box {
  width: 90%;
  height: 66px;
  border: 1px dashed #8a8a8a;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
