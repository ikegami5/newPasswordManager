package passwordManagerMain

import java.security.SecureRandom

import scala.util.Random
import passwordManagerMain.LineSeparators._

class Record(info: String) {
  val data: Array[String] = info.split(",", -1).map(s => s.trim)
  val serviceName: String = data(0).replace("\\C", ",")
  val serviceInfo: String = data(1).replace("\\C", ",").replace("\\n", lineSeparator)
  val passwordHasCapital: Boolean = data(2).toBoolean
  val passwordHasNumeral: Boolean = data(3).toBoolean
  val symbolsInPassword: String = data(4).replace("\\S", " ").replace("\\C", ",")
  val lengthOfPassword: Int = data(5).toInt
  var salt: List[String] = data.slice(6, data.length).toList.reverse

  def appendSalt(): Record = {
    new Record(info + ", " + Record.generateSalt)
  }

  override def toString: String = info
}

object Record {

  def apply(serviceName: String, serviceInfo: String, passwordHasCapital: Boolean,
             passwordHasNumeral: Boolean, symbolsInPassword: String, lengthOfPassword: Int): Record = {
    new Record(Seq(serviceName.replace(",", "\\C"), unifyLineSeparator(serviceInfo).replace(lineSeparator, "\\n").replace(",", "\\C"),
      passwordHasCapital.toString, passwordHasNumeral.toString,
      symbolsInPassword.toSet.toList.mkString.replace(",", "\\C").replace(" ", "\\S"), lengthOfPassword.min(64).toString,
      generateSalt()).mkString(", "))
  }

  def generateSalt(): String = {
    new Random(new SecureRandom()).alphanumeric.take(64).mkString
  }

}
