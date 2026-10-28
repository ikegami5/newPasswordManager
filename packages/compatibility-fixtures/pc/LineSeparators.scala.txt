package passwordManagerMain

object LineSeparators {
  def lineSeparator: String = System.lineSeparator()

  def unifyLineSeparator(str: String): String = {
    str.replace("\r\n", "\n").replace("\r", "\n").replace("\n", lineSeparator)
  }

}
