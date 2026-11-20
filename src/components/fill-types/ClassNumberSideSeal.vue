<template>
  <div class="side-seal-area">
    <div class="side-seal-strip">
      <div class="side-seal-number-table">
        <div class="side-seal-number-row">
          <div
            v-for="label in sideSealClassRowLabels"
            :key="`class-col-${label}`"
            class="side-seal-number-column"
          >
            <div class="side-seal-number-stack">
              <span
                v-for="digit in sideSealDigitsTopDown"
                :key="`student-${label}-${digit}`"
                class="side-seal-number-cell"
              >
                <span class="side-seal-digit">{{ digit }}</span>
              </span>
              <span class="side-seal-divider-cell"></span>
            </div>
            <span class="side-seal-row-label">{{ label }}</span>
          </div>
        </div>
        <div class="side-seal-number-row">
          <div
            v-for="label in sideSealStudentRowLabels"
            :key="`student-col-${label}`"
            class="side-seal-number-column"
          >
            <div class="side-seal-number-stack">
              <span
                v-for="digit in sideSealDigitsTopDown"
                :key="`student-${label}-${digit}`"
                class="side-seal-number-cell"
              >
                <span class="side-seal-digit">{{ digit }}</span>
              </span>
              <span class="side-seal-divider-cell"></span>
            </div>
            <span class="side-seal-row-label">{{ label }}</span>
          </div>
        </div>
      </div>

      <div class="side-seal-write-list">
        <div class="side-seal-write-item">
          <span class="side-seal-write-line"></span>
          <span class="side-seal-write-label">座位号：</span>
        </div>
        <div class="side-seal-write-item">
          <span class="side-seal-write-line"></span>
          <span class="side-seal-write-label">考场：</span>
        </div>
        <div class="side-seal-write-item">
          <span class="side-seal-write-line"></span>
          <span class="side-seal-write-label">姓名：</span>
        </div>
      </div>
    </div>
    <div class="side-seal-dotted"></div>
    <div class="side-seal-text side-seal-text-binding">装</div>
    <div class="side-seal-text side-seal-text-binding-middle">订</div>
    <div class="side-seal-text side-seal-text-binding-bottom">线</div>
    <div class="side-seal-text side-seal-text-seal-top">密</div>
    <div class="side-seal-text side-seal-text-seal-middle">封</div>
    <div class="side-seal-text side-seal-text-seal-bottom">处</div>
  </div>
</template>

<script>
export default {
  name: 'ClassNumberSideSeal',
  props: {
    sideSealClassRowLabels: { type: Array, default: () => [] },
    sideSealStudentRowLabels: { type: Array, default: () => [] },
    sideSealDigitsTopDown: { type: Array, default: () => [] }
  }
};
</script>

<style scoped>
.side-seal-area {
  position: absolute;
  left: 24px;
  top: 60px;
  bottom: 60px;
  width: 120px;
  min-width: 120px;
}

.side-seal-strip {
  width: 50px;
  min-width: 50px;
  box-sizing: border-box;
  background: #fff;
  position: absolute;
  left: 14px;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  padding: 6px 4px;
  gap: 12px;
}

.side-seal-number-table {
  border: 3px solid #000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.side-seal-number-row {
  display: flex;
  height: 286px;
  align-items: center;
  justify-content: center;
}

.side-seal-number-row + .side-seal-number-row {
  border-top: 2px solid #000;
}

.side-seal-number-column {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.side-seal-number-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 13px;
  border-left: 1px solid #000;
}

.side-seal-divider-cell {
  width: 20px;
  height: 18px;
  border: black solid 1px;
  border-left: 0;
  border-right: 0;
}

.side-seal-row-label {
  font-size: 10px;
  font-weight: 600;
  transform: rotate(270deg);
  transform-origin: center;
  width: 20px;
  height: 18px;
}

.side-seal-number-cell {
  width: 20px;
  height: 10px;
  border: 1px solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(90deg);
  transform-origin: center;
  box-sizing: border-box;
  background: #fff;
}

.side-seal-digit {
  font-size: 10px;
  line-height: 1;
  transform: rotate(180deg);
}

.side-seal-write-list {
  height: 400px;
  padding-top: 20px;
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.side-seal-write-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  height: 120px;
  width: 50px;
}

.side-seal-write-label {
  display: inline-block;
  font-size: 10px;
  line-height: 1;
  font-weight: 600;
  transform: rotate(270deg);
  transform-origin: center;
  white-space: nowrap;
  width: 30px;
  height: 22px;
}

.side-seal-write-line {
  width: 60px;
  border-top: 1px solid #000;
  transform: rotate(90deg);
  transform-origin: center;
}

.side-seal-dotted {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: 88px;
  border-left: 1px dotted #8a8a8a;
}

.side-seal-text {
  position: absolute;
  left: 100px;
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 6px;
  font-size: 15px;
  font-weight: 600;
  color: #000;
  white-space: nowrap;
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.side-seal-text-binding {
  top: 120px;
}

.side-seal-text-binding-middle {
  top: 136px;
}

.side-seal-text-binding-bottom {
  top: 152px;
}

.side-seal-text-seal-top {
  top: 400px;
}

.side-seal-text-seal-middle {
  top: 416px;
}

.side-seal-text-seal-bottom {
  top: 432px;
}
</style>
